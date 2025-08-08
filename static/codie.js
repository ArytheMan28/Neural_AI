import { contentFilterText, stopAtLastPeriod, removeBlankLines, toBase64, uploadFile } from "./content-filter.js";
import { elevenlabs_api_key, hugging_face_key } from "./keys.js";

const micButton = document.querySelector('.mic-btn');
const entry = document.querySelector(".image-gen-entry");
const frame = document.querySelector('.text-frame');
const submitButton = document.querySelector('.submit-btn');
const downloadButton = document.querySelector('.download-btn');
const downloadableLink = document.querySelector('.download-link');
const codieIntroTag = document.createElement('div');
const codieInstructionTag = document.createElement('div');
const fileReader = new FileReader();
const imgPromtString = ['picture', 'image', 'show me', 'photo'];
const records = [];
let mediaRecorder;

codieStart();

function addBubbleEvent(bubble) {
    bubble.addEventListener('click', () => {
        const text = bubble.innerHTML.trim();
        const voiceId = "hfQockxJ0Fvm4US5gOaV";

        const options = {
            method: 'POST',
            headers: {
                'xi-api-key': elevenlabs_api_key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        };

        fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, options)
            .then(async (response) => {
                if (!response.ok) {
                    console.error("TTS Error:", await response.text());
                    alert("Text-to-speech failed. Try again later.");
                    return;
                }
                const arrayBuffer = await response.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(blob);
                const audioElement = new Audio(audioUrl);
                audioElement.play();
            })
            .catch((error) => {
                console.error("Fetch error in TTS:", error);
                alert("Something went wrong with text-to-speech.");
            });
    });
}

async function audioToText(filename) {
    const response = await fetch(
        "https://router.huggingface.co/fal-ai/fal-ai/whisper",
        {
            headers: {
                Authorization: `Bearer ${hugging_face_key}`,
                "Content-Type": "audio/flac",
            },
            method: "POST",
            body: JSON.stringify(filename),
        }
    );
    const result = await response.json();
    return result;
}

fileReader.onload = function (event) {
    const arrayBuffer = event.target.result;
};

async function textGen(data) {
    const response = await fetch(
        "https://router.huggingface.co/featherless-ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${hugging_face_key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "user",
                        content: `${data.inputs}`,
                    },
                ],
                model: 'mistralai/Mistral-7B-Instruct-v0.2',
                stream: false,
            }),
        }
    );
    const result = await response.json();
    return [{ "generated_text": result.choices[0].message.content }];
}

async function imageGen(data) {
    const response = await fetch(
        "https://router.huggingface.co/nebius/v1/images/generations", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${hugging_face_key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: `${data.inputs}`,
                response_format: "b64_json",
                model: "stability-ai/sdxl",
            }),
        });
    const jsonResponse = await response.json();
    const base64String = jsonResponse.data[0].b64_json;
    return `data:image/png;base64,${base64String}`;
}

navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    mediaRecorder = new MediaRecorder(stream);
    let chunks = [];
    mediaRecorder.ondataavailable = function (event) {
        chunks = [];
        chunks.push(event.data);
    };
    mediaRecorder.onstop = function () {
        micButton.disabled = true;
        const blob = new Blob(chunks, { 'type': 'audio/ogg; codecs=opus' });
        audioToText(blob).then(async (response) => {
            const userAudio = response.text.toLowerCase();
            const userInput = addUserBubble(userAudio);
            const aiOutput = addLoadingBubble();
            await mainCall(userAudio, userInput, aiOutput);
        });
    };
}).catch(function (err) {
    console.error('Error accessing microphone:', err);
});

micButton.addEventListener('click', () => {
    const icon = micButton.childNodes[0].nodeName.toLowerCase();
    if (icon === 'i') {
        const soundIcon = document.createElement('img');
        soundIcon.src = "../../static/asset/sound.gif";
        soundIcon.classList.add('sound-waves');
        micButton.replaceChild(soundIcon, micButton.childNodes[0]);
        mediaRecorder.start();
    } else {
        const micIcon = document.createElement('i');
        micIcon.classList.add('fa-solid', 'fa-microphone');
        micButton.replaceChild(micIcon, micButton.childNodes[0]);
        mediaRecorder.stop();
    }
});

downloadButton.addEventListener('click', () => {
    const filename = "records.txt";
    let conversation = "";
    if (records.length > 0) {
        records.forEach(record => {
            conversation += record + '\n\n';
        });
        const blob = new Blob([conversation], { type: 'text/plain;charset=utf-8' });
        downloadableLink.download = filename;
        downloadableLink.href = window.URL.createObjectURL(blob);
    }
});

submitButton.addEventListener('click', () => {
    submitEntry();
    submitButton.disabled = true;
});

async function submitEntry() {
    const input = entry.value.toLowerCase().trim();
    if (!input) return;

    // UI response: clear input and show bubbles
    entry.value = "";
    const userInput = addUserBubble(input);
    const aiOutput = addLoadingBubble();

    await mainCall(input, userInput, aiOutput);
    submitButton.disabled = false;
}

function addUserBubble(text) {
    const userInput = document.createElement('div');
    userInput.classList.add("user-bubble");
    userInput.innerHTML = text;
    frame.appendChild(userInput);
    frame.scrollTop = frame.scrollHeight;
    return userInput;
}

function addLoadingBubble() {
    const aiOutput = document.createElement('div');
    aiOutput.classList.add("ai-bubble");
    aiOutput.innerHTML = "Loading...";
    frame.appendChild(aiOutput);
    frame.scrollTop = frame.scrollHeight;
    return aiOutput;
}

async function mainCall(userValue, userInput, aiOutput) {
    if (!userValue) return;

    let contentValue = await contentFilterText(userValue);
    if (contentValue !== 1) {
        setPlaceholder(contentValue);
        return;
    }

    if (checkImgPromt(userValue)) {
        const img = document.createElement('img');
        const imgCon = document.createElement('div');
        imgCon.classList.add('image-bubble');

        try {
            const base64Image = await imageGen({ inputs: userValue });
            const uploadedUrl = await uploadFile(base64Image);
            img.src = uploadedUrl;
            img.classList.add('image-generated-codie');
            imgCon.appendChild(img);
            frame.appendChild(imgCon);
            aiOutput.innerHTML = 'Here is your image!';
            frame.scrollTop = frame.scrollHeight;
            records.push("User: " + userValue);
            records.push("AI: [Image]");
        } catch (error) {
            aiOutput.innerHTML = "Image generation failed.";
        }
    } else {
        try {
            const textResult = await textGen({ inputs: userValue });
            const outputText = stopAtLastPeriod(textResult[0].generated_text);
            const cleanOutput = removeBlankLines(outputText);
            aiOutput.innerHTML = cleanOutput;
            aiOutput.classList.add("custom-cursor");
            addBubbleEvent(aiOutput);
            frame.scrollTop = frame.scrollHeight;
            records.push("User: " + userValue);
            records.push("AI: " + cleanOutput);
        } catch (error) {
            aiOutput.innerHTML = "Text generation failed.";
        }
    }

    resetPlaceholder();
    submitButton.disabled = false;
    micButton.disabled = false;
}

function codieStart() {
    const codieIntro = "Hello, my name is Neural Bot. How can I assist you?";
    const codieInstruction = "Start your sentence with 'generate me an image' or anything to just chat with me!";
    codieIntroTag.classList.add('ai-bubble', 'custom-cursor');
    codieInstructionTag.classList.add('ai-bubble', 'custom-cursor');
    codieIntroTag.textContent = codieIntro;
    codieInstructionTag.textContent = codieInstruction;
    addBubbleEvent(codieIntroTag);
    addBubbleEvent(codieInstructionTag);
    frame.appendChild(codieIntroTag);
    frame.appendChild(codieInstructionTag);
    records.push("AI: " + codieIntro);
    records.push("AI: " + codieInstruction);
}

function setPlaceholder(cv) {
    entry.value = "";
    entry.placeholder = (cv === 0) ? "Please be appropriate!" : "There has been an error.";
}

function resetPlaceholder() {
    entry.value = '';
    entry.placeholder = "Chat with Codie or ask him to generate an image";
}

function checkImgPromt(input) {
    return imgPromtString.some(trigger => input.includes(trigger));
}
