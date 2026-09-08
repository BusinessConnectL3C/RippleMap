"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeatureLayerTable } from "@/components/maps/FeatureLayerTable";

interface LayerOption {
  id: string;
  title: string;
}

export function FeatureLayerExplorer({
  itemId,
  layers,
}: {
  itemId: string;
  layers: LayerOption[];
}) {
  const [layerId, setLayerId] = useState(layers[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-4">
      {layers.length > 1 && (
        <div className="max-w-xs">
          <Select value={layerId} onValueChange={setLayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a layer" />
            </SelectTrigger>
            <SelectContent>
              {layers.map((layer) => (
                <SelectItem key={layer.id} value={layer.id}>
                  {layer.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {layerId && <FeatureLayerTable key={layerId} itemId={itemId} layerId={layerId} />}
    </div>
  );
}
