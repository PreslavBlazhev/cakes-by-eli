import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { Card, PageHeader } from "@/components/admin/ui";
import { DessertTypeDialog } from "../DessertTypeDialog";
import { GroupsManager } from "./GroupsManager";
import { RulesManager } from "./RulesManager";
import { db } from "@/db/client";
import { customizationRules, dessertTypes } from "@/db/schema";
import { getDessertConfigById } from "@/server/queries/configurator";
import { listAllCategories } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const rows = await db
    .select({ name: dessertTypes.name })
    .from(dessertTypes)
    .where(eq(dessertTypes.id, id))
    .limit(1);
  return { title: rows[0]?.name ?? "Персонализации" };
}

export default async function CustomizationDetailPage({ params }: Params) {
  const { id } = await params;

  const [typeRows, config, rules, categories] = await Promise.all([
    db.select().from(dessertTypes).where(eq(dessertTypes.id, id)).limit(1),
    getDessertConfigById(id, { activeOnly: false }),
    db
      .select()
      .from(customizationRules)
      .where(eq(customizationRules.dessertTypeId, id))
      .orderBy(asc(customizationRules.createdAt)),
    listAllCategories(),
  ]);

  const type = typeRows[0];
  if (!type || !config) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/customizations", label: "Всички видове" }}
        title={type.name}
        description="Групите са въпросите, които клиентът вижда. Опциите са възможните отговори."
        actions={
          <DessertTypeDialog
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            existing={{
              id: type.id,
              name: type.name,
              renderer: type.renderer,
              description: type.description,
              categoryId: type.categoryId,
              basePriceCents: type.basePriceCents,
              sortOrder: type.sortOrder,
              isActive: type.isActive,
            }}
          />
        }
      />

      <div className="space-y-4">
        <GroupsManager dessertTypeId={type.id} groups={config.groups} />

        <Card
          title="Правила за показване"
          description="Скриват или показват група/опция според друг избор. Например: „Цвят на дрипа“ се показва само когато покритието е „Дрип“."
        >
          <RulesManager
            dessertTypeId={type.id}
            groups={config.groups}
            rules={rules.map((rule) => ({
              id: rule.id,
              targetType: rule.targetType,
              targetKey: rule.targetKey,
              targetGroupKey: rule.targetGroupKey,
              mode: rule.mode,
              whenGroupKey: rule.whenGroupKey,
              whenOptionKeys: rule.whenOptionKeys,
            }))}
          />
        </Card>
      </div>
    </>
  );
}
