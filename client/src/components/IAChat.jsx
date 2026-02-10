// Fichier: src/components/IAChat.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    TextField,
    Button,
    IconButton,
    Typography,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Avatar,
    Tooltip,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Send as SendIcon,
    SmartToy as AiIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Info as InfoIcon,
    ThumbUp as ThumbUpIcon,
    ThumbDown as ThumbDownIcon,
    History as HistoryIcon
} from '@mui/icons-material';
import { iaService } from '../services/api-ia';
import { useSnackbar } from 'notistack';

const IAChat = ({ contactId, onContactCreated, onOrderCreated, height = '500px' }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentContactId, setCurrentContactId] = useState(contactId);
    const [showFeedback, setShowFeedback] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const messagesEndRef = useRef(null);
    const { enqueueSnackbar } = useSnackbar();

    // Charger l'historique
    useEffect(() => {
        if (currentContactId && currentContactId !== 'new') {
            loadHistory();
        }
    }, [currentContactId]);

    // Scroll automatique
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadHistory = async () => {
        try {
            const response = await iaService.getConversations(currentContactId, 10);
            if (response.success) {
                const historyMessages = response.conversations.map(conv => ({
                    id: conv.id,
                    type: 'user',
                    content: conv.message_text,
                    timestamp: new Date(conv.created_at),
                    original: conv
                }));
                
                const aiMessages = response.conversations
                    .filter(conv => conv.ai_response)
                    .map(conv => ({
                        id: conv.id + '_ai',
                        type: 'ai',
                        content: conv.ai_response,
                        timestamp: new Date(conv.created_at),
                        reasoning: conv.reasoning_log,
                        original: conv
                    }));
                
                // Combiner et trier par date
                const allMessages = [...historyMessages, ...aiMessages]
                    .sort((a, b) => a.timestamp - b.timestamp);
                
                setMessages(allMessages);
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setLoading(true);
        const messageToSend = input;
        setInput('');

        try {
            const response = await iaService.chat(currentContactId, messageToSend);
            
            if (response.success) {
                const aiMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: response.response,
                    reasoning: response.reasoning,
                    intent: response.intent,
                    timestamp: new Date(),
                    contactId: response.contactId
                };

                setMessages(prev => [...prev, aiMessage]);

                // Mettre à jour le contact
                if (response.contactId && response.contactId !== currentContactId) {
                    setCurrentContactId(response.contactId);
                    if (onContactCreated) {
                        onContactCreated(response.contactId);
                    }
                    enqueueSnackbar('Nouveau contact créé', { variant: 'success' });
                }

                // Notifier si contact créé
                if (response.contactCreated) {
                    enqueueSnackbar('Contact créé automatiquement', { variant: 'info' });
                }
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('Erreur chat:', error);
            enqueueSnackbar('Erreur de communication', { variant: 'error' });
            
            const errorMessage = {
                id: Date.now() + 1,
                type: 'error',
                content: 'Erreur de communication avec le serveur',
                timestamp: new Date()
            };
            
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleFeedback = (message) => {
        setSelectedMessage(message);
        setShowFeedback(true);
    };

    const submitFeedback = async () => {
        if (!selectedMessage || !feedbackText.trim()) return;

        try {
            await iaService.submitFeedback(
                selectedMessage.original?.id,
                feedbackText
            );
            
            setShowFeedback(false);
            setFeedbackText('');
            enqueueSnackbar('Feedback envoyé', { variant: 'success' });
            
        } catch (error) {
            console.error('Erreur feedback:', error);
            enqueueSnackbar('Erreur envoi feedback', { variant: 'error' });
        }
    };

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleClearHistory = () => {
        setMessages([]);
        handleMenuClose();
        enqueueSnackbar('Historique effacé', { variant: 'info' });
    };

    // Dans IAChat.jsx, ajoutez ces fonctions :

    const handleProductSearch = async (searchTerm) => {
        try {
            const response = await iaService.searchProducts({ search: searchTerm });
            if (response.success) {
                // Afficher les résultats
                const productList = response.products.map(p => 
                    `${p.nom} - ${p.prix}€ (Stock: ${p.stock})`
                ).join('\n');
                
                const systemMessage = {
                    id: Date.now(),
                    type: 'system',
                    content: `Produits trouvés:\n${productList}`,
                    timestamp: new Date()
                };
                
                setMessages(prev => [...prev, systemMessage]);
            }
        } catch (error) {
            console.error('Erreur recherche:', error);
        }
    };

    const handleOrderCreation = async (productId, quantity) => {
        try {
            const orderData = {
                contactId: currentContactId,
                items: [{
                    productId,
                    quantity
                }],
                paymentMethod: 'carte'
            };
            
            const response = await iaService.createOrder(orderData);
            
            if (response.success) {
                const successMessage = {
                    id: Date.now(),
                    type: 'system',
                    content: `✅ Commande créée: ${response.order.numero_commande}`,
                    timestamp: new Date()
                };
                
                setMessages(prev => [...prev, successMessage]);
                
                if (onOrderCreated) {
                    onOrderCreated(response.order);
                }
            }
        } catch (error) {
            console.error('Erreur création commande:', error);
        }
    };

    // Ajoutez ces commandes dans l'interface
    const quickCommands = [
        { label: '📦 Voir mes commandes', command: 'Quel est le statut de mes commandes ?' },
        { label: '💰 Chercher produit', command: 'Chercher produit ' },
        { label: '📊 Produits populaires', command: 'Quels sont vos produits les plus vendus ?' },
        { label: '📄 Générer facture', command: 'Générer une facture pour la commande ' }
    ];

    const renderMessage = (msg) => {
        const isUser = msg.type === 'user';
        const isError = msg.type === 'error';
        
        return (
            <Box
                key={msg.id}
                sx={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    mb: 2,
                    px: 2
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', maxWidth: '80%' }}>
                    {!isUser && !isError && (
                        <Avatar sx={{ mr: 1, bgcolor: 'primary.main' }}>
                            <AiIcon />
                        </Avatar>
                    )}
                    
                    <Card
                        sx={{
                            backgroundColor: isError ? 'error.light' : 
                                           isUser ? 'primary.light' : 'background.paper',
                            color: isError ? 'error.contrastText' :
                                   isUser ? 'primary.contrastText' : 'text.primary',
                            borderRadius: 2,
                            maxWidth: '100%'
                        }}
                    >
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                    {msg.timestamp.toLocaleTimeString()}
                                </Typography>
                                
                                {msg.type === 'ai' && msg.reasoning && (
                                    <Tooltip title={JSON.stringify(msg.reasoning, null, 2)}>
                                        <IconButton size="small" sx={{ ml: 1 }}>
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                            
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                {msg.content}
                            </Typography>
                            
                            {msg.type === 'ai' && msg.intent && (
                                <Chip
                                    label={`Intention: ${msg.intent.type}`}
                                    size="small"
                                    sx={{ mt: 1, mr: 1 }}
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                            
                            {msg.type === 'ai' && (
                                <Box sx={{ mt: 1 }}>
                                    <Tooltip title="Bonne réponse">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleFeedback(msg)}
                                        >
                                            <ThumbUpIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Corriger">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleFeedback(msg)}
                                        >
                                            <ThumbDownIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                    
                    {isUser && (
                        <Avatar sx={{ ml: 1, bgcolor: 'grey.500' }}>
                            <PersonIcon />
                        </Avatar>
                    )}
                </Box>
            </Box>
        );
    };

    return (
        <>
            <Paper sx={{ height, display: 'flex', flexDirection: 'column' }}>
                {/* En-tête */}
                <Box sx={{ 
                    p: 2, 
                    borderBottom: 1, 
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AiIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">
                            Assistant IA CRM
                        </Typography>
                    </Box>
                    
                    <Box>
                        <Chip
                            label={`Contact: ${currentContactId || 'Nouveau'}`}
                            size="small"
                            sx={{ mr: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.2)' }}
                        />
                        <IconButton
                            size="small"
                            onClick={handleMenuOpen}
                            sx={{ color: 'white' }}
                        >
                            <SettingsIcon />
                        </IconButton>
                    </Box>
                </Box>
                
                {/* Messages */}
                <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
                    {messages.length === 0 ? (
                        <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            textAlign: 'center',
                            p: 3
                        }}>
                            <AiIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                Assistant IA CRM
                            </Typography>
                            <Typography color="text.secondary" paragraph>
                                Posez-moi une question ou commencez une conversation.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Exemples :
                            </Typography>
                            <Box sx={{ mt: 2, textAlign: 'left' }}>
                                <Typography variant="body2" color="text.secondary">
                                    • "Bonjour, je m'appelle Jean, email jean@exemple.com"
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    • "Je veux commander 2 produits Premium"
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    • "Quels sont vos horaires d'ouverture ?"
                                </Typography>
                            </Box>
                        </Box>
                    ) : (
                        messages.map(renderMessage)
                    )}
                    <div ref={messagesEndRef} />
                </Box>
                
                {/* Input */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Tapez votre message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            disabled={loading}
                            multiline
                            maxRows={3}
                        />
                        <Button
                            variant="contained"
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            sx={{ minWidth: 100 }}
                        >
                            {loading ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                <>
                                    <SendIcon sx={{ mr: 1 }} />
                                    Envoyer
                                </>
                            )}
                        </Button>
                    </Box>
                </Box>
            </Paper>
            
            {/* Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleClearHistory}>
                    <HistoryIcon sx={{ mr: 1 }} />
                    Effacer l'historique
                </MenuItem>
            </Menu>
            
            {/* Dialog feedback */}
            <Dialog open={showFeedback} onClose={() => setShowFeedback(false)}>
                <DialogTitle>Feedback sur la réponse</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Réponse originale: {selectedMessage?.content}
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Votre correction"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Comment aurait-elle dû répondre ?"
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowFeedback(false)}>Annuler</Button>
                    <Button 
                        variant="contained" 
                        onClick={submitFeedback}
                        disabled={!feedbackText.trim()}
                    >
                        Envoyer
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default IAChat;