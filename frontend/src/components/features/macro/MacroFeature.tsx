'use client'
import { useMacroQuery } from '@/hooks/queries/useMacroQuery'
import { MacroIndicatorGrid } from '@/components/compounds/MacroIndicatorGrid'
import { BriefFeature } from '@/components/features/brief/BriefFeature'
import { PanelHeader } from '@/components/primitives/PanelHeader'
import { SpacePanel } from '@/components/layout/SpaceLayout'
import { SpaceLayout } from '@/components/layout/SpaceLayout'

export function MacroFeature() {
  const { data, isLoading, dataUpdatedAt } = useMacroQuery()

  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <SpaceLayout space="macro">
      {/* Left: Indicator grid */}
      <SpacePanel className="overflow-y-auto">
        <div className="p-3">
          <PanelHeader
            title="Economic Indicators"
            actions={
              updatedTime ? (
                <span className="text-[10px] text-[var(--color-text-muted)]">Updated {updatedTime}</span>
              ) : null
            }
          />
        </div>
        <MacroIndicatorGrid data={data} isLoading={isLoading} />
      </SpacePanel>

      {/* Right: AI Brief */}
      <SpacePanel className="overflow-y-auto p-3">
        <PanelHeader title="Market Brief" />
        <BriefFeature />
      </SpacePanel>
    </SpaceLayout>
  )
}
