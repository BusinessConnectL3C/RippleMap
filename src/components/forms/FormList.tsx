import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { FileText, Layers, ChevronRight } from "lucide-react";

interface Props {
  survey123Items: ArcGISItem[];
  fieldmapsItems: ArcGISItem[];
}

function ItemRow({ item, icon: Icon, badge }: { item: ArcGISItem; icon: React.ElementType; badge: string }) {
  return (
    <Link href={`/forms/${item.id}`}>
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-[#1B4F72] hover:shadow-sm transition-all group">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EBF5FB]">
          <Icon className="h-5 w-5 text-[#1B4F72]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {badge}
            </span>
          </div>
          {item.snippet && (
            <p className="text-sm text-gray-500 truncate">{item.snippet}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#1B4F72] transition-colors" />
      </div>
    </Link>
  );
}

export function FormList({ survey123Items, fieldmapsItems }: Props) {
  const hasContent = survey123Items.length > 0 || fieldmapsItems.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-14 w-14 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-700">No forms or layers yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Forms and FieldMaps layers shared to your group will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {survey123Items.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Survey123 Forms</h2>
          </div>
          <div className="space-y-2">
            {survey123Items.map((item) => (
              <ItemRow key={item.id} item={item} icon={FileText} badge="Survey123" />
            ))}
          </div>
        </section>
      )}

      {fieldmapsItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">FieldMaps Layers</h2>
          </div>
          <div className="space-y-2">
            {fieldmapsItems.map((item) => (
              <ItemRow key={item.id} item={item} icon={Layers} badge="FieldMaps" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
