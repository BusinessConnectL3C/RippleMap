"use client";

import { useEffect, useRef } from "react";

interface Props {
  itemId: string;
  token: string;
  title: string;
}

export function ArcGISMapEmbed({ itemId, token, title }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let view: { destroy: () => void } | null = null;

    async function loadMap() {
      const [{ default: WebMap }, { default: MapView }, { default: IdentityManager }] =
        await Promise.all([
          import("@arcgis/core/WebMap"),
          import("@arcgis/core/views/MapView"),
          import("@arcgis/core/identity/IdentityManager"),
        ]);

      IdentityManager.registerToken({
        server: "https://www.arcgis.com/sharing/rest",
        token,
      });

      const webMap = new WebMap({ portalItem: { id: itemId } });
      view = new MapView({
        container: mapRef.current!,
        map: webMap,
      });
    }

    loadMap();

    return () => {
      view?.destroy();
    };
  }, [itemId, token]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[600px]"
      aria-label={`Map: ${title}`}
    />
  );
}
