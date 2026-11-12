"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ExternalLink, Upload } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeltMapEmbed } from "@/components/maps/FeltMapEmbed";
import { AddDataPanel } from "@/components/maps/AddDataPanel";
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
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open in Felt
                </a>
              </Button>
            )}
            {addData && (
              <Button
                size="sm"
                variant={panelOpen ? "outline" : "default"}
                className="gap-1.5"
                aria-expanded={panelOpen}
                aria-controls="add-data-panel"
                onClick={() => setPanelOpen((o) => !o)}
              >
                <Upload className="h-3.5 w-3.5" /> Add data
              </Button>
            )}
          </>
        }
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <FeltMapEmbed feltMapId={feltMapId} title={title} canSetThumbnail={canSetThumbnail} />
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
    </div>
  );
}
