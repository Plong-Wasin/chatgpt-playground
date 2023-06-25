const localStorageApiKey = "openai-api-key";
let apiKey = localStorage.getItem(localStorageApiKey);
const presets = JSON.parse(localStorage.getItem("presets") ?? "{}");
const startUpPreset = presets[localStorage.getItem("startUpPreset")]
    ? localStorage.getItem("startUpPreset")
    : "";
let models = [];
function deleteMessage(button) {
    const message = button.closest(".message");
    message.parentNode.removeChild(message);
}

function switchRole(el) {
    el.classList.toggle("user");
    el.classList.toggle("assistant");
    el.innerText = el.innerText === "User:" ? "Assistant:" : "User:";
    const textEl = el.parentNode.querySelector(".text");
    textEl.dataset.role = el.classList.contains("user") ? "user" : "assistant";
}

function addChat(role = null, text = "") {
    const chat = document.getElementById("chat");
    const userMessage = document.createElement("div");
    // get last text element in chat
    const lastRole = chat
        .querySelector(".message:last-child")
        ?.querySelector(".text")?.dataset?.role;
    const nextRole = role ?? (lastRole === "user" ? "assistant" : "user");
    let upperFirstLetter =
        nextRole.charAt(0).toUpperCase() + nextRole.slice(1).toLowerCase();
    userMessage.className = "message";
    userMessage.innerHTML = `
      <div>
        <span class="${nextRole}" onclick="switchRole(this)">${upperFirstLetter}:</span>
        <textarea oninput="adjustHeight(this)" class="text" data-role="${nextRole}" placeholder="New message">${text}</textarea>
        <button class="delete" onclick="deleteMessage(this)">-</button>
      </div>
    `;
    chat.appendChild(userMessage);
    chat.scrollTop = chat.scrollHeight;
    adjustHeight(userMessage.querySelector(".text"));
}

document.addEventListener("DOMContentLoaded", function () {
    reloadChatPresetSelect();
    reloadStartUpPreset();
    document.querySelector("#startUpPresetSelect").value = startUpPreset;
    document.querySelector("#chatPresetSelect").value = startUpPreset;
    autoResizeTextArea();
    initializeTabs();
    setApiKey();
    if (startUpPreset) {
        loadChat(startUpPreset);
    } else {
        addChat();
    }
    (async () => {
        await fetchModel();
        generateModelOptions();
    })();
    syncInputAndRange("temperatureInput", "temperatureRange");
    syncInputAndRange("maxLengthInput", "maxLengthRange");
    syncInputAndRange("topPInput", "topPRange");
    syncInputAndRange("frequencyPenaltyInput", "frequencyPenaltyRange");
    syncInputAndRange("presencePenaltyInput", "presencePenaltyRange");
});
function setApiKey() {
    document
        .querySelector("#apiKeyButton")
        .addEventListener("click", function () {
            const key = prompt("Enter API Key");
            if (key) {
                localStorage.setItem(localStorageApiKey, key);
                apiKey = key;
            }
            fetchModel().then(() => {
                generateModelOptions();
            });
        });
}

async function fetchModel() {
    const url = "https://api.openai.com/v1/models";
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });
    const data = await response.json();
    if (data.error) {
        document.querySelector("#apiKeyButton").click();
        return;
    }
    models = data.data.filter((model) => {
        // return id prefix chat
        return model.id.startsWith("gpt");
    });
    models = models.map((model) => model.id);
    models.sort();
}
function generateModelOptions() {
    const modelSelectEl = document.querySelector("#modelSelect");
    for (let i = 0; i < models.length; i++) {
        const option = document.createElement("option");
        option.value = models[i];
        option.innerText = models[i];
        modelSelectEl.appendChild(option);
    }
}
async function fetchChat() {
    const url = "https://api.openai.com/v1/chat/completions";
    const data = getChatData();
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        method: "POST",
    });
    const responseData = await response.json();
    return (
        responseData?.choices?.[0]?.message?.content ??
        `Error: ${responseData?.error?.message}`
    );
}
async function streamChat() {
    const url = "https://api.openai.com/v1/chat/completions";
    const data = getChatData();
    data.stream = true;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        method: "POST",
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const resultText = document
        .querySelector(".message:last-child")
        ?.querySelector(".text");
    resultText.value = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        // Massage and parse the chunk of data
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        const parsedLines = lines
            .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
            .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
            .map((line) => JSON.parse(line)); // Parse the JSON string

        for (const parsedLine of parsedLines) {
            const { choices } = parsedLine;
            const { delta } = choices[0];
            const { content } = delta;
            // Update the UI with the new content
            if (content) {
                resultText.value += content;
                adjustHeight(resultText);
            }
        }
    }
    return resultText.value;
}
function initializeTabs() {
    const systemContainer = document.querySelector(".system-container");
    const chatContainer = document.querySelector(".chat-container");
    const settingContainer = document.querySelector(".setting-container");
    const systemTabButton = document.getElementById("systemTabButton");
    const chatTabButton = document.getElementById("chatTabButton");
    const settingTabButton = document.getElementById("settingTabButton");

    systemTabButton.addEventListener("click", function () {
        systemContainer.classList.add("active");
        chatContainer.classList.remove("active");
        settingContainer.classList.remove("active");
        systemTabButton.classList.add("active");
        chatTabButton.classList.remove("active");
        settingTabButton.classList.remove("active");
    });

    chatTabButton.addEventListener("click", function () {
        systemContainer.classList.remove("active");
        chatContainer.classList.add("active");
        settingContainer.classList.remove("active");
        systemTabButton.classList.remove("active");
        chatTabButton.classList.add("active");
        settingTabButton.classList.remove("active");
        document.querySelectorAll(".text").forEach((el) => {
            adjustHeight(el);
        });
    });

    settingTabButton.addEventListener("click", function () {
        systemContainer.classList.remove("active");
        chatContainer.classList.remove("active");
        settingContainer.classList.add("active");
        systemTabButton.classList.remove("active");
        chatTabButton.classList.remove("active");
        settingTabButton.classList.add("active");
    });

    chatTabButton.click();
}
function adjustHeight(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
}

function autoResizeTextArea() {
    const systemTextarea = document.getElementById("systemTextarea");

    systemTextarea.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
    });
}
function generateChat(el) {
    // show loading
    el.innerText = "Generating...";
    el.disabled = true;
    addChat("assistant");
    // fetchChat().then((chat) => {
    //     addChat();
    //     // get element last message
    //     const lastMessage = document.querySelector(".message:last-child");
    //     // get role
    //     const role = lastMessage.querySelector(".text").dataset.role;
    //     if (role === "user") {
    //         lastMessage.querySelector(".user").click();
    //     }
    //     const textEl = lastMessage.querySelector(".text");
    //     textEl.value = chat;
    //     adjustHeight(textEl);
    //     el.innerText = "Generate";
    //     el.disabled = false;
    // });
    streamChat();
    el.innerText = "Generate";
    el.disabled = false;
}
function syncInputAndRange(inputId, rangeId) {
    var numberInput = document.getElementById(inputId);
    var rangeInput = document.getElementById(rangeId);

    // Update number input value when range input changes
    rangeInput.addEventListener("input", function () {
        numberInput.value = rangeInput.value;
    });

    // Update range input value when number input changes
    numberInput.addEventListener("input", function () {
        rangeInput.value = numberInput.value;
    });
}
function getChatData() {
    const messages = [
        {
            role: "system",
            content: document.querySelector("#systemTextarea").value,
        },
    ];
    document.querySelectorAll(".chat .text").forEach((el) => {
        messages.push({
            role: el.dataset.role,
            content: el.value,
        });
    });
    const data = {
        model: document.querySelector("#modelSelect").value,
        temperature: +document.querySelector("#temperatureRange").value,
        max_tokens: +document.querySelector("#maxLengthRange").value,
        top_p: +document.querySelector("#topPRange").value,
        frequency_penalty: +document.querySelector("#frequencyPenaltyRange")
            .value,
        presence_penalty: +document.querySelector("#presencePenaltyRange")
            .value,
        messages,
    };
    return data;
}
function saveAsChat() {
    const data = getChatData();
    const inputChatName = prompt("Enter chat name");
    const chatName = inputChatName.trim();
    if (inputChatName !== null) {
        if (presets[chatName]) {
            alert("Chat name already exists");
            return;
        }
        presets[chatName] = data;
        localStorage.setItem("presets", JSON.stringify(presets));
        reloadChatPresetSelect();
        reloadStartUpPreset();
        document.querySelector("#chatPresetSelect").value = chatName;
    }
}
function reloadChatPresetSelect() {
    const chatPresetSelect = document.querySelector("#chatPresetSelect");
    chatPresetSelect.innerHTML = "";
    for (const [key, value] of Object.entries(presets)) {
        const option = document.createElement("option");
        option.value = key;
        option.innerText = key;
        chatPresetSelect.appendChild(option);
    }
}
function reloadStartUpPreset() {
    // <option value="">New</option>
    const startUpPresetSelect = document.querySelector("#startUpPresetSelect");
    const startUpPreset = startUpPresetSelect.value;
    startUpPresetSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.innerText = "New";
    startUpPresetSelect.appendChild(option);
    for (const [key, value] of Object.entries(presets)) {
        const option = document.createElement("option");
        option.value = key;
        option.innerText = key;
        startUpPresetSelect.appendChild(option);
    }
    startUpPresetSelect.value = startUpPreset;
}
function saveStartUpPreset() {
    const startUpPresetSelect = document.querySelector("#startUpPresetSelect");
    const startUpPreset = startUpPresetSelect.value;
    localStorage.setItem("startUpPreset", startUpPreset);
}
function deleteChat() {
    const chatPresetSelect = document.querySelector("#chatPresetSelect");
    const chatPreset = chatPresetSelect.value;
    if (confirm(`Delete ${chatPreset}?`)) {
        delete presets[chatPreset];
        localStorage.setItem("presets", JSON.stringify(presets));
        reloadChatPresetSelect();
        reloadStartUpPreset();
    }
}

function saveChat() {
    const chatPresetSelect = document.querySelector("#chatPresetSelect");
    const chatPreset = chatPresetSelect.value;
    if (!chatPreset) {
        saveAsChat();
        return;
    }
    if (confirm(`Save ${chatPreset}?`)) {
        presets[chatPreset] = getChatData();
        localStorage.setItem("presets", JSON.stringify(presets));
        reloadChatPresetSelect();
        reloadStartUpPreset();
    }
}
function loadChat(startUp = false) {
    const chatPresetSelect = document.querySelector("#chatPresetSelect");
    const chatPreset = chatPresetSelect.value;
    const preset = startUp ? startUpPreset : chatPreset;
    if (!startUp) {
        if (!confirm(`Load ${chatPreset}?`)) {
            return;
        }
    }
    const data = presets[preset];
    document.querySelector("#systemTextarea").value = data.messages[0].content;
    document.querySelector(".chat").innerText = "";
    for (let i = 1; i < data.messages.length; i++) {
        addChat(data.messages[i].role, data.messages[i].content);
    }
    document.querySelector("#modelSelect").value = data.model;
    document.querySelector("#temperatureRange").value = data.temperature;
    document.querySelector("#maxLengthRange").value = data.max_tokens;
    document.querySelector("#topPRange").value = data.top_p;
    document.querySelector("#frequencyPenaltyRange").value =
        data.frequency_penalty;
    document.querySelector("#presencePenaltyRange").value =
        data.presence_penalty;
    document.querySelector("#temperatureInput").value = data.temperature;
    document.querySelector("#maxLengthInput").value = data.max_tokens;
    document.querySelector("#topPInput").value = data.top_p;
    document.querySelector("#frequencyPenaltyInput").value =
        data.frequency_penalty;
    document.querySelector("#presencePenaltyInput").value =
        data.presence_penalty;
}
