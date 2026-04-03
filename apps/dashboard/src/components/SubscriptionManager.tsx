import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Subscription } from '../types';

interface SubscriptionManagerProps {
  deviceId: string;
  subscriptions: Subscription[];
  onSubscriptionsChanged: () => void;
}

export function SubscriptionManager({ deviceId, subscriptions, onSubscriptionsChanged }: SubscriptionManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ stopId: string; stopName: string }[]>([]);
  const [selectedStop, setSelectedStop] = useState<{ stopId: string; stopName: string } | null>(null);
  const [line, setLine] = useState('');
  const [direction, setDirection] = useState('uptown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const stops = await api.searchStops(searchQuery);
        setSearchResults(stops);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddSubscription = async () => {
    if (!selectedStop || !line) {
      setError('Please select a stop and enter a line');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await api.createSubscription(deviceId, {
        provider: 'mta',
        line,
        direction,
        stopId: selectedStop.stopId,
      });

      // Reset form
      setIsAdding(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedStop(null);
      setLine('');
      setDirection('uptown');
      
      onSubscriptionsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: number) => {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteSubscription(deviceId, subscriptionId);
      onSubscriptionsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Transit Subscriptions</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          {isAdding ? 'Cancel' : '+ Add Subscription'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isAdding && (
        <div className="border border-gray-300 rounded-lg p-4 mb-4 bg-gray-50">
          <h3 className="font-medium mb-3">Add New Subscription</h3>
          
          {/* Search stops */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Search Stop</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search (e.g., '14 st', 'Times Sq')"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                {searchResults.map((stop) => (
                  <button
                    key={stop.stopId}
                    onClick={() => {
                      setSelectedStop(stop);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                  >
                    {stop.stopName}
                  </button>
                ))}
              </div>
            )}
            {selectedStop && (
              <div className="mt-2 px-3 py-2 bg-blue-100 border border-blue-300 rounded-md flex justify-between items-center">
                <span><strong>Selected:</strong> {selectedStop.stopName}</span>
                <button
                  onClick={() => setSelectedStop(null)}
                  className="text-blue-700 hover:text-blue-900"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Line */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Line (e.g., 1, A, Q)</label>
            <input
              type="text"
              value={line}
              onChange={(e) => setLine(e.target.value.toUpperCase())}
              placeholder="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              maxLength={3}
            />
          </div>

          {/* Direction */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="uptown">Uptown / North</option>
              <option value="downtown">Downtown / South</option>
            </select>
          </div>

          <button
            onClick={handleAddSubscription}
            disabled={loading || !selectedStop || !line}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Adding...' : 'Add Subscription'}
          </button>
        </div>
      )}

      {/* List existing subscriptions */}
      <div className="space-y-2">
        {subscriptions.length === 0 ? (
          <p className="text-gray-500 text-sm">No subscriptions yet. Add one to get started!</p>
        ) : (
          subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex justify-between items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <div>
                <span className="font-medium">{sub.routeId}</span> - {sub.stopName}
                <span className="text-gray-500 text-sm ml-2">
                  ({sub.direction === 0 ? 'Uptown/North' : 'Downtown/South'})
                </span>
              </div>
              <button
                onClick={() => handleDeleteSubscription(sub.id)}
                disabled={loading}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
