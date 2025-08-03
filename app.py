import os
from flask import Flask, render_template, request, jsonify, send_file
from dotenv import load_dotenv
import google.generativeai as genai
from utils import format_message, get_code_styles
from database import ChatDatabase
from datetime import datetime
import io

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'default-secret-key')

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-2.5-pro')

# Initialize database
db = ChatDatabase()

# Store chat sessions in memory for active conversations
chat_sessions = {}

@app.route('/')
def index():
    """Render the main chat interface"""
    code_styles = get_code_styles()
    return render_template('index.html', code_styles=code_styles)

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests"""
    try:
        data = request.json
        user_message = data.get('message', '')
        session_id = data.get('session_id', 'default')
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Create or get session
        if session_id not in chat_sessions:
            # Check if session exists in database
            session = db.get_session(session_id)
            if not session:
                # Create new session in database
                db.create_session(session_id)
            
            # Load chat history from database
            messages = db.get_messages(session_id)
            history = []
            for msg in messages:
                history.append({
                    'role': 'user' if msg['sender'] == 'user' else 'model',
                    'parts': [msg['content']]
                })
            
            # Create new Gemini chat with history
            chat_sessions[session_id] = model.start_chat(history=history)
        
        chat = chat_sessions[session_id]
        
        # Save user message to database
        db.add_message(session_id, 'user', user_message)
        
        # Send message to Gemini
        response = chat.send_message(user_message)
        
        # Format the response with markdown
        formatted_response = format_message(response.text)
        
        # Save assistant response to database
        db.add_message(session_id, 'assistant', response.text, formatted_response)
        
        return jsonify({
            'response': formatted_response,
            'raw_response': response.text,
            'session_id': session_id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sessions', methods=['GET'])
def get_sessions():
    """Get all chat sessions"""
    try:
        sessions = db.get_all_sessions()
        return jsonify({'sessions': sessions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sessions/<session_id>', methods=['GET'])
def get_session_history(session_id):
    """Get chat history for a specific session"""
    try:
        session = db.get_session(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        messages = db.get_messages(session_id)
        return jsonify({
            'session': session,
            'messages': messages
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session"""
    try:
        db.delete_session(session_id)
        
        # Remove from active sessions if present
        if session_id in chat_sessions:
            del chat_sessions[session_id]
        
        return jsonify({'message': 'Session deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear', methods=['POST'])
def clear_chat():
    """Clear current chat session"""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        
        # Delete from database
        db.delete_session(session_id)
        
        # Remove from active sessions
        if session_id in chat_sessions:
            del chat_sessions[session_id]
        
        return jsonify({'message': 'Chat cleared successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search', methods=['POST'])
def search():
    """Search through chat history"""
    try:
        data = request.json
        query = data.get('query', '')
        
        if not query:
            return jsonify({'results': []})
        
        results = db.search_messages(query)
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/export/<session_id>/<format>', methods=['GET'])
def export_session(session_id, format):
    """Export a session in specified format"""
    try:
        if format not in ['json', 'txt']:
            return jsonify({'error': 'Invalid format. Use json or txt'}), 400
        
        export_data = db.export_session(session_id, format)
        
        # Create file-like object
        file = io.BytesIO()
        file.write(export_data.encode('utf-8'))
        file.seek(0)
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'chat_export_{session_id}_{timestamp}.{format}'
        
        return send_file(
            file,
            mimetype='application/json' if format == 'json' else 'text/plain',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available Gemini models"""
    try:
        models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models.append({
                    'name': m.name,
                    'display_name': m.display_name,
                    'description': m.description
                })
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/format-preview', methods=['POST'])
def format_preview():
    """Preview markdown formatting"""
    try:
        data = request.json
        text = data.get('text', '')
        formatted = format_message(text)
        return jsonify({'formatted': formatted})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    app.run(debug=debug, port=port, host='0.0.0.0')