from flask import Flask, render_template, request, jsonify
import os, requests

app = Flask(__name__)

# ---- PAGES (unchanged) ----
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/pages/imgGen')
def imgGen():
    return render_template('/pages/imgGen.html')

@app.route('/pages/textGen')
def textGen():
    return render_template('/pages/textGen.html')

@app.route('/pages/codie')
def codie():
    return render_template('/pages/codie.html')


# ---- API: secure proxy to Hugging Face (uses env var 'hugging_face_key') ----
HF_API_URL = "https://api-inference.huggingface.co/v1/chat/completions"
HF_MODEL   = "mistralai/Mistral-7B-Instruct-v0.2"
HF_TOKEN   = os.getenv("hugging_face_key")  # set this in Render → Environment

@app.post("/api/chat")
def api_chat():
    if not HF_TOKEN:
        return jsonify({"ok": False, "error": "Server missing env var 'hugging_face_key'"}), 500

    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"ok": False, "error": "missing prompt"}), 400

    try:
        r = requests.post(
            HF_API_URL,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "model": HF_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user",   "content": prompt},
                ],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": False,
            },
            timeout=60,
        )
        if r.status_code != 200:
            # bubble up HF error to make debugging obvious
            return jsonify({"ok": False, "error": f"HF {r.status_code}: {r.text}"}), 502

        payload = r.json()
        text = (payload.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        return jsonify({"ok": True, "text": text})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 502


if __name__ == '__main__':
    app.run(debug=True)
