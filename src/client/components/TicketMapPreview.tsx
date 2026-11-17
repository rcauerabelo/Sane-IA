import React from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  Map as GoogleMap,
  Pin,
  useApiIsLoaded,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';

interface TicketMapPreviewProps {
  latitude: number;
  longitude: number;
  title?: string;
}

export const TicketMapPreview: React.FC<TicketMapPreviewProps> = ({
  latitude,
  longitude,
  title = 'Local do chamado',
}) => {
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE ||
    !isLoaded
  ) {
    return null;
  }

  return (
    <div className="h-52 w-full rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={{ lat: latitude, lng: longitude }}
        center={{ lat: latitude, lng: longitude }}
        defaultZoom={16}
        gestureHandling="cooperative"
        disableDefaultUI={true}
        zoomControl={true}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={{ lat: latitude, lng: longitude }} title={title}>
          <Pin background="#09090b" borderColor="#ffffff" glyphColor="#ffffff" />
        </AdvancedMarker>
      </GoogleMap>
    </div>
  );
};
