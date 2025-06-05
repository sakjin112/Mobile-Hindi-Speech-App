import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  ImageBackground,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import axios from 'axios';

// Install this package for speech recognition
// expo install @react-native-voice/voice

// Your ChatGPT API configuration
const CHATGPT_API_URL = 'https://api.openai.com/v1/chat/completions';
const CHATGPT_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY; // We'll set this up

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState();
  const [recordingAnimation] = useState(new Animated.Value(1));
  const [isListening, setIsListening] = useState(false);

  // Speech Recognition using Web Speech API (works in Expo Go web)
  const [recognition, setRecognition] = useState(null);

  // Voice recognition setup
  useEffect(() => {
    setupAudio();
    setupSpeechRecognition();
  }, []);

  const setupSpeechRecognition = () => {
    if (Platform.OS === 'web' && 'webkitSpeechRecognition' in window) {
      const speechRecognition = new window.webkitSpeechRecognition();
      speechRecognition.continuous = true;
      speechRecognition.interimResults = true;
      speechRecognition.lang = 'hi-IN'; // Hindi
      
      speechRecognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        setUserResponse(finalTranscript + interimTranscript);
      };
      
      speechRecognition.onend = () => {
        setIsListening(false);
        setIsRecording(false);
      };
      
      speechRecognition.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        setIsListening(false);
        setIsRecording(false);
      };
      
      setRecognition(speechRecognition);
    }
  };

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.log('Error setting up audio:', error);
    }
  };

  // Recording animation
  useEffect(() => {
    if (isRecording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      console.log('🎬 Starting recording...');
      setIsRecording(true);
      setUserResponse("");
      
      if (Platform.OS === 'web' && recognition) {
        // Use Web Speech API
        setIsListening(true);
        recognition.start();
      } else {
        // Use Audio recording for mobile (we can add speech-to-text service later)
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(recording);
      }
      
    } catch (error) {
      console.log('❌ Failed to start recording', error);
      setIsRecording(false);
      setIsListening(false);
    }
  };

  const stopRecording = async () => {
    console.log('🛑 Stopping recording...');
    setIsRecording(false);
    setIsListening(false);
    
    if (Platform.OS === 'web' && recognition) {
      // Stop Web Speech API
      recognition.stop();
    } else if (recording) {
      // Stop audio recording
      setRecording(undefined);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording saved to', uri);
      
      // For mobile, add placeholder text (can integrate with cloud speech-to-text later)
      setUserResponse("Voice recorded (add speech-to-text service for mobile)");
    }
  };

  const speakText = (text) => {
    Speech.speak(text, {
      language: 'hi-IN',
      rate: 0.8,
    });
  };

  const sendToAi = async () => {
    const finalText = userResponse.trim();
    if (finalText === "") return;

    const userMessage = {
      type: "user",
      text: finalText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // ChatGPT API call
      const response = await axios.post(CHATGPT_API_URL, {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful Hindi-speaking assistant. Always respond in Hindi (Devanagari script). Be conversational and helpful."
          },
          {
            role: "user",
            content: finalText
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }, {
        headers: {
          'Authorization': `Bearer ${CHATGPT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const aiResponseText = response.data.choices[0].message.content;

      const aiMessage = {
        type: "ai",
        text: aiResponseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      speakText(aiResponseText);

    } catch (error) {
      console.log('❌ Error:', error);
      
      // Fallback response if API fails
      const errorMessage = {
        type: "ai",
        text: "माफ करें, मुझे आपसे जुड़ने में समस्या हो रही है। कृपया बाद में कोशिश करें।",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      speakText(errorMessage.text);
    }

    setIsLoading(false);
    setUserResponse("");
  };

  const addTestMessage = () => {
    setUserResponse("नमस्ते, आप कैसे हैं?");
  };

  const renderMessage = (msg, index) => (
    <View key={index} style={[styles.message, msg.type === 'user' ? styles.userMessage : styles.aiMessage]}>
      <Text style={styles.messageSender}>
        {msg.type === "user" ? "👤 You" : "🤖 AI Assistant"}
      </Text>
      <Text style={styles.messageText}>{msg.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section with Background Image */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1589730880765-6adf993bb581?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
        style={styles.header}
        imageStyle={styles.headerImage}
        resizeMode="cover"
      >
        <View style={styles.headerOverlay}>
          <Text style={styles.title}>Hindi Voice Assistant</Text>
          <Text style={styles.hindiTitle}>हिंदी वॉयस असिस्टेंट</Text>
          <Text style={styles.subtitle}>Talk to me in Hindi!</Text>
        </View>
      </ImageBackground>

      {/* Status Section */}
      <View style={styles.statusSection}>
        <View style={[styles.statusItem, isRecording && styles.recordingActive]}>
          <Text style={styles.statusLabel}>Recording Status: </Text>
          <Text style={styles.statusValue}>
            {isRecording ? (isListening ? " 🔴 Listening..." : " 🔴 Recording...") : " ⚪ Ready to listen"}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>You said: </Text>
          <Text style={styles.statusValue}>{userResponse || " Nothing yet"}</Text>
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView style={styles.messageContainer} showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <View style={styles.noMessages}>
            <Text style={styles.welcomeText}>💬 Your conversation will appear here...</Text>
            <Text style={styles.welcomeText}>आपकी बातचीत यहाँ दिखाई देगी...</Text>
          </View>
        ) : (
          messages.map((msg, index) => renderMessage(msg, index))
        )}
      </ScrollView>

      {/* Text Input Section */}
      <View style={styles.inputSection}>
        <TextInput
          style={styles.textInput}
          value={userResponse}
          onChangeText={setUserResponse}
          placeholder="Type your message in Hindi... (हिंदी में टाइप करें)"
          placeholderTextColor="#666"
          multiline
        />
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.testBtn}
          onPress={addTestMessage}
        >
          <Text style={styles.btnText}>🧪 Test</Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity: recordingAnimation }}>
          <TouchableOpacity
            style={[styles.btn, styles.recordBtn, isRecording && styles.recordingBtn]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.btnText}>
              {isRecording ? "🔴 Stop" : "🎤 Record"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[
            styles.btn,
            styles.sendBtn,
            (userResponse === "" || isLoading) && styles.btnDisabled
          ]}
          onPress={sendToAi}
          disabled={userResponse === "" || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>📤 Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  
  // Header Styles (matching your original CSS)
  header: {
    height: 250, // Fixed height instead of minHeight
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
  headerImage: {
    borderRadius: 20,
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lighter overlay to show more image
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f5f5f5',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  hindiTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f5f5f5',
    textAlign: 'center',
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#f5f5f5',
    textAlign: 'center',
    marginTop: 5,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },

  // Status Section (matching your original CSS)
  statusSection: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    margin: 5,
    backgroundColor: '#917c71',
    borderRadius: 8,
  },
  recordingActive: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#ff4757',
  },
  statusLabel: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 16,
  },
  statusValue: {
    color: '#333333',
    fontWeight: '900',
    fontStyle: 'italic',
    fontSize: 16,
  },

  // Message Styles (matching your original CSS)
  messageContainer: {
    flex: 1, // Back to flexible height - takes remaining space
    minHeight: 300, // But ensure minimum readable height
    maxHeight: 500, // And cap it so header still shows
    backgroundColor: 'rgba(143, 131, 131, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 10,
    shadowColor: '#e1e0e0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  message: {
    margin: 10,
    padding: 15,
    borderRadius: 15,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  userMessage: {
    backgroundColor: '#68001d',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  aiMessage: {
    backgroundColor: '#005014',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  messageSender: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#fff',
    marginBottom: 5,
    opacity: 0.9,
  },
  messageText: {
    fontSize: 24, // Matching your large font size
    color: '#fff',
    lineHeight: 28,
  },
  noMessages: {
    alignItems: 'center',
    padding: 40,
  },
  welcomeText: {
    color: '#1e1e1e',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },

  // Input Section
  inputSection: {
    backgroundColor: '#333',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 50,
    maxHeight: 100,
    color: '#333',
  },

  // Control Buttons (matching your original CSS)
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
    marginBottom: 10,
  },
  btn: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  testBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 45,
    backgroundColor: '#f39c12',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  recordBtn: {
    backgroundColor: '#f8036d', // Your original gradient colors
  },
  recordingBtn: {
    backgroundColor: '#faa046', // Your recording state color
  },
  sendBtn: {
    backgroundColor: '#74c42e', // Your original send button color
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});