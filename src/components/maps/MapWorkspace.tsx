"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import type { FeltController } from "@feltmaps/js-sdk";
import { ExternalLink, Printer, Table2, Upload } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeltMapEmbed } from "@/components/maps/FeltMapEmbed";
import { AddDataPanel } from "@/components/maps/AddDataPanel";
import { PrintDialog, type ViewState } from "@/components/maps/PrintDialog";
import { CANCEL_PICK_EVENT, LOCATION_PICKED_EVENT, PICK_LOCATION_EVENT } from "@/components/maps/AddRecordsForm";

interface Props {
  feltMapId: string;
  title: string;
  canSetThumbnail: boolean;
  /** Field Editors only: link to the map in Felt. */
  feltUrl: string | null;
  /** Owners/admins/staff only: the Add data panel's settings. */
  addData: Omit<ComponentProps<typeof AddDataPanel>, "onClose"> | null;
}

/**
 * The map page body: the map fills the space, and Add data opens as a panel
 * beside it (over it on small screens) so the map stays usable, e.g. for
 * picking a record's location.
 */
export function MapWorkspace({ feltMapId, title, canSetThumbnail, feltUrl, addData }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  // While a record's location is being picked, get the panel out of the way
  // on screens where it covers the map.
  const [picking, setPicking] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const controllerRef = useRef<FeltController | null>(null);
  const onController = useCallback((felt: FeltController | null) => {
    controllerRef.current = felt;
  }, []);
  /** Felt's own table pane (view-only), opened on the first visible layer that has records. */
  const openTable = useCallback(async () => {
    const felt = controllerRef.current;
    if (!felt) return;
    try {
      const layers = (await felt.getLayers()).filter((l): l is NonNullable<typeof l> => !!l);
      const first = layers.find((l) => l.visible && "geometryType" in l && l.geometryType !== "Raster") ?? layers[0];
      await felt.showLayerDataTable(first ? { layerId: first.id } : undefined);
    } catch {
      await felt.showLayerDataTable().catch(() => {});
    }
  }, []);

  /** What the viewer sees now: area, layers turned on, and whether legend/viewer filters are applied. */
  const getViewState = useCallback(async (): Promise<ViewState | null> => {
    const felt = controllerRef.current;
    if (!felt) return null;
    try {
      const [{ bounds }, layers] = await Promise.all([felt.getViewport(), felt.getLayers()]);
      const present = layers.filter((l): l is NonNullable<typeof l> => !!l);
      const [filters, legendItems] = await Promise.all([
        Promise.all(present.map((l) => felt.getLayerFilters(l.id).catch(() => null))),
        felt.getLegendItems().catch(() => []),
      ]);
      // Categories switched off in the legend are filters too.
      const hiddenCategory = legendItems.some((i) => !!i && !i.visible && present.some((l) => l.visible && l.id === i.layerId));
      const active = (f: unknown) => f !== null && f !== undefined && f !== true;
      // Layers whose legend/viewer filters change what's shown: print their combined filters.
      const layerFilters = present.flatMap((l, i) => {
        const f = filters[i];
        return l.visible && f && (active(f.components) || active(f.ephemeral)) ? [{ layerId: l.id, filters: f.combined }] : [];
      });
      return {
        bounds: bounds as [number, number, number, number],
        visibleLayerIds: present.filter((l) => l.visible).map((l) => l.id),
        allLayersVisible: present.every((l) => l.visible),
        filters: layerFilters,
        hiddenCategory,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const start = () => setPicking(true);
    const stop = () => setPicking(false);
    window.addEventListener(PICK_LOCATION_EVENT, start);
    window.addEventListener(LOCATION_PICKED_EVENT, stop);
    window.addEventListener(CANCEL_PICK_EVENT, stop);
    return () => {
      window.removeEventListener(PICK_LOCATION_EVENT, start);
      window.removeEventListener(LOCATION_PICKED_EVENT, stop);
      window.removeEventListener(CANCEL_PICK_EVENT, stop);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={title}
        backHref="/maps"
        backLabel="Maps & Apps"
        actions={
          <>
            {feltUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a
                  href={feltUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Edit this map in Felt. Sign in to Felt with your Field Editor account."
                  aria-label="Open in Felt"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Open in Felt</span>
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Open the data table"
              title="Browse, search and sort each layer's records"
              onClick={openTable}
            >
              <Table2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Table</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" aria-label="Print" onClick={() => setPrintOpen(true)}>
              <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Print</span>
            </Button>
            {addData && (
              <Button
                size="sm"
                variant={panelOpen ? "outline" : "default"}
                className="gap-1.5"
                aria-label="Add data"
                aria-expanded={panelOpen}
                aria-controls="add-data-panel"
                onClick={() => setPanelOpen((o) => !o)}
              >
                <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add data</span>
              </Button>
            )}
          </>
        }
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <FeltMapEmbed
            feltMapId={feltMapId}
            title={title}
            canSetThumbnail={canSetThumbnail}
            onController={onController}
          />
        </div>
        {addData && panelOpen && (
          <aside
            id="add-data-panel"
            aria-label="Add data"
            className={cn(
              "absolute inset-y-0 right-0 z-20 w-full border-l border-border shadow-xl transition-transform duration-200 sm:w-[440px]",
              "lg:static lg:z-auto lg:shadow-none",
              picking && "max-lg:translate-x-full"
            )}
          >
            <AddDataPanel {...addData} onClose={() => setPanelOpen(false)} />
          </aside>
        )}
      </div>
      <PrintDialog
        feltMapId={feltMapId}
        mapTitle={title}
        open={printOpen}
        onOpenChange={setPrintOpen}
        getViewState={getViewState}
      />
    </div>
  );
}
