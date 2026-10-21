/** Session rail list filter options (FE-01 / DSK-08). */
import { t } from '../../../i18n/index.js'

export function buildSessionListFilterOptions() {
  return [
    { label: t('workbench.listFilter.all'), value: 'all' },
    { label: t('workbench.listFilter.active'), value: 'active' },
    { label: t('workbench.listFilter.archived'), value: 'archived' },
  ]
}
