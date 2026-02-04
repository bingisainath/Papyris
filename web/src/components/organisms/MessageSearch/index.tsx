// src/components/organisms/MessageSearch/index.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { chatService } from '../../../services/chat.service';
import { debounce } from '../../../utils/debounce.utils';
import { formatMessageTime } from '../../../utils/format.utils';
import type { SearchResult } from '../../../types/chat.types';

interface MessageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  conversationId?: string;
  onSelectMessage?: (messageId: string) => void;
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  isOpen,
  onClose,
  token,
  conversationId,
  onSelectMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const response = await chatService.searchMessages(query, token, conversationId);
        if (response.success && response.data) {
          setResults(response.data.results);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [token, conversationId]
  );

  useEffect(() => {
    if (isOpen) {
      performSearch(searchQuery);
    }
  }, [searchQuery, isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    if (onSelectMessage) {
      onSelectMessage(result.message.id);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mt-20 max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={conversationId ? 'Search in conversation...' : 'Search all messages...'}
            autoFocus
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            ✕
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : !searchQuery.trim() ? (
            <div className="text-center py-12">
              <span className="text-6xl">🔍</span>
              <p className="text-gray-600 mt-4">Type to search messages</p>
              <p className="text-sm text-gray-400 mt-2">↑↓ navigate • Enter select • Esc close</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl">😕</span>
              <p className="text-gray-600 mt-4">No messages found</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 px-2 mb-3">
                Found {results.length} {results.length === 1 ? 'result' : 'results'}
              </p>
              {results.map((result, index) => (
                <button
                  key={result.message.id}
                  onClick={() => handleSelectResult(result)}
                  className={`
                    w-full text-left p-4 rounded-xl transition-all
                    ${
                      index === selectedIndex
                        ? 'bg-purple-50 border-2 border-purple-200'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {result.message.sender_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">
                          {result.message.sender_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatMessageTime(result.message.timestamp)}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{result.message.text}</p>
                      {result.conversation && !conversationId && (
                        <p className="text-xs text-gray-500 mt-1">
                          💬 in {result.conversation.name}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              {selectedIndex + 1} of {results.length}
            </p>
            <p className="text-xs text-gray-500">↑↓ Navigate • Enter Select • Esc Close</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageSearch;