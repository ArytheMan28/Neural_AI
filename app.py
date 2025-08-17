# ----- HF chat proxy: keeps your key server-side -----
import os, requests
from flask import request, jsonify

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
            return jsonify({"ok": False, "error": f"HF {r.status_code}: {r.text}"}), 502
        data = r.json()
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
        return jsonify({"ok": True, "text": text})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 502
