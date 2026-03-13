"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Send, MessageCircle, ArrowUp } from 'lucide-react';
import posthog from 'posthog-js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  summary?: string | null;
  transcript?: string | null;
  locale: string;
  contentLanguage?: string;
  fileId: string | null;
  title?: string | null;
  sourceType?: 'youtube' | 'pdf' | 'audio';
}

const Chat: React.FC<ChatProps> = ({
  summary,
  transcript,
  locale,
  contentLanguage,
  fileId,
  title,
  sourceType,
}) => {
  const t = useTranslations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMultiline, setIsMultiline] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat history from DB
  useEffect(() => {
    if (!fileId) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/files/chat/messages?fileId=${fileId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          setMessages(data.messages.map((m: any, i: number) => ({
            id: m.id || `history-${i}`,
            role: m.role,
            content: m.content,
          })));
        }
      } catch {
        // Silently fail - chat still works without history
      }
    };

    loadMessages();
  }, [fileId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
      setIsMultiline(scrollHeight > textareaRef.current.clientHeight || inputMessage.includes('\n'));
    }
  }, [inputMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    posthog.capture('chat_message_sent', {
      source_type: sourceType || 'youtube',
      message_length: userMessage.content.length,
      is_first_message: messages.length === 0,
    });

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('/api/files/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage.trim(),
          videoTitle: title,
          summary,
          transcript,
          contentLanguage: contentLanguage || 'en',
          conversationHistory: messages.slice(-10),
          sourceType: sourceType || 'youtube',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get chat response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessageContent = '';

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantMessageContent += chunk;

          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantMessageContent }
                : msg
            )
          );
        }
      }

      // Save full chat history to DB
      if (fileId && assistantMessageContent) {
        const allMessages = [
          ...messages,
          { role: 'user', content: inputMessage.trim() },
          { role: 'assistant', content: assistantMessageContent },
        ].map(({ role, content }) => ({ role, content }));

        fetch('/api/files/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, messages: allMessages }),
        }).catch(() => {});
      }

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!transcript && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <MessageCircle className="h-10 w-10 text-foreground mb-4" />
        <p className="text-muted-foreground">
          {t('Chat.noContent')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center pt-36 h-full text-center px-4">
            <MessageCircle className="h-10 w-10 text-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {t(`Chat.title_${sourceType || 'youtube'}`)}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t(`Chat.description_${sourceType || 'youtube'}`)}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-accent rounded-2xl px-4 py-2.5 max-w-[85%]'
                      : 'max-w-[85%]'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-sm text-red-500 text-center">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-4">
        <div className="max-w-3xl mx-auto">
          <div className={`relative flex items-end gap-2 border bg-background p-2 ${isMultiline ? 'rounded-2xl' : 'rounded-full'}`}>
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('Chat.placeholder')}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="flex-shrink-0 self-end rounded-full bg-primary p-2 text-primary-foreground transition-opacity disabled:opacity-50"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
