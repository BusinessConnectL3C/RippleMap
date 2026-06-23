"use client";

interface Props {
  itemId: string;
  token: string;
  title: string;
}

export function ArcGISMapEmbed({ itemId, token, title }: Props) {
  const src = `https://www.arcgis.com/apps/mapviewer/index.html?webmap=${itemId}&token=${token}`;

  return (
    <iframe
      src={src}
      title={title}
      style={{ width: "100%", height: "calc(100vh - 57px)", border: "none" }}
      allowFullScreen
    />
  );
}
