import React from 'react';
import { useLocation } from '../hooks/useLocation';

interface LocationStatusProps {
  className?: string;
  showDetails?: boolean;
  showSchedule?: boolean;
}

const LocationStatus: React.FC<LocationStatusProps> = ({ 
  className = '', 
  showDetails = true, 
  showSchedule = false 
}) => {
  const { 
    currentLocation, 
    lastUpdate, 
    nextScheduledUpdates,
    isLocationFresh,
    getLocationStats,
    locationSource,
    error,
    isTracking,
    updateLocation
  } = useLocation();

  const getStatusIcon = () => {
    if (isTracking) return '🔄';
    if (error) return '🔴';
    if (!currentLocation) return '📍';
    
    switch (locationSource) {
      case 'live':
        return '🟢';
      case 'cached':
        return '🟡';
      case 'fallback':
        return '🟠';
      default:
        return '📍';
    }
  };

  const getStatusText = () => {
    if (isTracking) return 'Updating...';
    if (error) return 'Location unavailable';
    if (!currentLocation) return 'No location';
    
    const fresh = isLocationFresh();
    
    switch (locationSource) {
      case 'live':
        return fresh ? 'Live location' : 'Recent location';
      case 'cached':
        return fresh ? 'Cached location' : 'Old cached location';
      case 'fallback':
        return 'Fallback location';
      default:
        return 'Location available';
    }
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never updated';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatNextUpdate = (time: Date) => {
    const now = new Date();
    const diff = time.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) return `${minutes}m`;
    if (hours < 24) return `${hours}h ${minutes}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  };

  const stats = getLocationStats();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Main Location Display */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getStatusIcon()}</span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">
                  {currentLocation ? `${currentLocation.city}, ${currentLocation.country}` : 'Location'}
                </h3>
                {currentLocation?.accuracy && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    currentLocation.accuracy === 'high' ? 'bg-green-100 text-green-800' :
                    currentLocation.accuracy === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentLocation.accuracy}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{getStatusText()}</p>
              {lastUpdate && (
                <p className="text-xs text-gray-500">Updated {formatLastUpdate()}</p>
              )}
            </div>
          </div>
          
          <button
            onClick={updateLocation}
            disabled={isTracking}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>{isTracking ? '🔄' : '🔁'}</span>
            <span>{isTracking ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {currentLocation?.fullAddress && showDetails && (
          <div className="mt-3 p-2 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600">{currentLocation.fullAddress}</p>
          </div>
        )}
      </div>

      {/* Location Statistics */}
      {showDetails && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-md p-2">
              <p className="text-xs text-gray-500">Total Updates</p>
              <p className="text-sm font-semibold text-gray-900">{stats.totalUpdates}</p>
            </div>
            <div className="bg-green-50 rounded-md p-2">
              <p className="text-xs text-gray-500">Successful</p>
              <p className="text-sm font-semibold text-green-700">{stats.successfulUpdates}</p>
            </div>
            <div className="bg-red-50 rounded-md p-2">
              <p className="text-xs text-gray-500">Failed</p>
              <p className="text-sm font-semibold text-red-700">{stats.failedUpdates}</p>
            </div>
          </div>
        </div>
      )}

      {/* Next Scheduled Updates */}
      {showSchedule && nextScheduledUpdates.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Next Updates</h4>
          <div className="space-y-1">
            {nextScheduledUpdates.map((update, index) => (
              <div key={index} className="flex justify-between items-center text-xs">
                <span className="text-gray-600">{update.label}</span>
                <span className="text-gray-900 font-medium">
                  in {formatNextUpdate(update.time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationStatus; 