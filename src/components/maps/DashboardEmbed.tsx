"use client";

interface Props {
  itemId: string;
  token: string;
  title: string;
}

export function DashboardEmbed({ itemId, token, title }: Props) {
  const src = `https://www.arcgis.com/apps/dashboards/${itemId}?token=${token}`;

  return (
    <iframe
      src={src}
      title={title}
      className="w-full h-full min-h-[600px] border-0"
      allowFullScreen
    />
  );
}
