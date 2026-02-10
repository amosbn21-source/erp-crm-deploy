import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button,
  IconButton,
  Avatar,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  Send as SendIcon,
  SmartToy as AIIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import iaService from '../../services/api-ia';

export default function IAChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Charger l'historique des conversations récentes
    fetchRecentConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRecentConversations = async () => {
    try {
      // Simuler une conversation récente
      setMessages([
        {
          id: 1,
          text: "Bonjour ! Je suis votre assistant IA CRM. Comment puis-je vous aider aujourd'hui ?",
          sender: 'ai',
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await iaService.chat(contactId || 'new', inputMessage);
      
      if (response.success) {
        const aiMessage = {
          id: messages.length + 2,
          text: response.response,
          sender: 'ai',
          timestamp: new Date().toISOString(),
          intent: response.intent
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // Mettre à jour le contactId si créé
        if (response.contactCreated && response.contactId) {
          setContactId(response.contactId);
        }
      } else {
        throw new Error(response.error || 'Erreur de réponse IA');
      }
    } catch (error) {
      console.error('Erreur chat:', error);
      
      const errorMessage = {
        id: messages.length + 2,
        text: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer.",
        sender: 'ai',
        timestamp: new Date().toISOString(),
        error: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          💬 Chat IA
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Assistant conversationnel intelligent
        </Typography>
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '70vh',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden'
      }}>
        {/* En-tête du chat */}
        <Box sx={{ 
          p: 2, 
          bgcolor: 'primary.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AIIcon />
          <Box>
            <Typography variant="h6">Assistant IA CRM</Typography>
            <Typography variant="caption">
              {contactId ? `Contact: ${contactId}` : 'Nouveau contact'}
            </Typography>
          </Box>
        </Box>
        
        {/* Zone des messages */}
        <Box sx={{ 
          flexGrow: 1, 
          p: 2,
          overflow: 'auto',
          bgcolor: 'grey.50'
        }}>
          {messages.map((message) => (
            <Box 
              key={message.id}
              sx={{ 
                display: 'flex',
                justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                mb: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', maxWidth: '80%' }}>
                {message.sender === 'ai' && (
                  <Avatar sx={{ mr: 1, bgcolor: '#7C3AED' }}>
                    <AIIcon />
                  </Avatar>
                )}
                
                <Paper 
                  sx={{ 
                    p: 2,
                    bgcolor: message.sender === 'user' ? 'primary.main' : 'white',
                    color: message.sender === 'user' ? 'white' : 'text.primary',
                    borderRadius: 2
                  }}
                >
                  <Typography variant="body1">{message.text}</Typography>
                  {message.intent && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block',
                        mt: 0.5,
                        opacity: 0.7
                      }}
                    >
                      Intention détectée: {message.intent.type}
                    </Typography>
                  )}
                </Paper>
                
                {message.sender === 'user' && (
                  <Avatar sx={{ ml: 1, bgcolor: 'secondary.main' }}>
                    <PersonIcon />
                  </Avatar>
                )}
              </Box>
            </Box>
          ))}
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Avatar sx={{ mr: 1, bgcolor: '#7C3AED' }}>
                <AIIcon />
              </Avatar>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography>L'IA réfléchit...</Typography>
                </Box>
              </Paper>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Box>
        
        {/* Zone de saisie */}
        <Box sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          bgcolor: 'white'
        }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              placeholder="Posez votre question à l'IA..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              variant="outlined"
            />
            <Button 
              variant="contained" 
              onClick={handleSendMessage}
              disabled={loading || !inputMessage.trim()}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              sx={{ minWidth: 100 }}
            >
              {loading ? '...' : 'Envoyer'}
            </Button>
          </Box>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            Appuyez sur Entrée pour envoyer, Shift+Entrée pour nouvelle ligne
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}