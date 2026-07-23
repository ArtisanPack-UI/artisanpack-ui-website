/**
 * Widget registration entry point. Imported once at app boot from
 * `resources/js/app.tsx` so every widget component is in the registry by
 * the time the Dashboard page mounts.
 *
 * Keep this list in sync with `App\Providers\DashboardWidgetServiceProvider`
 * — the keys here match each widget's server-side `extendedInfo()['component']`,
 * not the dashboard `type`.
 */
import { registerWidget } from '@/lib/admin/widget-registry';
import { InventoryAlertsWidget } from './InventoryAlertsWidget';
import { KpiTileWidget } from './KpiTileWidget';
import { LeadFunnelWidget } from './LeadFunnelWidget';
import { OrderStatusWidget } from './OrderStatusWidget';
import { RecentActivityWidget } from './RecentActivityWidget';
import { RecentLeadsWidget } from './RecentLeadsWidget';
import { RecentOrdersWidget } from './RecentOrdersWidget';
import { RevenueTrendWidget } from './RevenueTrendWidget';
import { SiteAtAGlanceWidget } from './SiteAtAGlanceWidget';
import { TrafficSourcesWidget } from './TrafficSourcesWidget';
import { UpdateBannerWidget } from './UpdateBannerWidget';
import { VisitorsTrendWidget } from './VisitorsTrendWidget';
import { WelcomeWidget } from './WelcomeWidget';

registerWidget('WelcomeWidget', WelcomeWidget);
registerWidget('UpdateBannerWidget', UpdateBannerWidget);
registerWidget('SiteAtAGlanceWidget', SiteAtAGlanceWidget);
registerWidget('RecentActivityWidget', RecentActivityWidget);
registerWidget('KpiTileWidget', KpiTileWidget);
registerWidget('RevenueTrendWidget', RevenueTrendWidget);
registerWidget('VisitorsTrendWidget', VisitorsTrendWidget);
registerWidget('TrafficSourcesWidget', TrafficSourcesWidget);
registerWidget('RecentOrdersWidget', RecentOrdersWidget);
registerWidget('RecentLeadsWidget', RecentLeadsWidget);
registerWidget('OrderStatusWidget', OrderStatusWidget);
registerWidget('LeadFunnelWidget', LeadFunnelWidget);
registerWidget('InventoryAlertsWidget', InventoryAlertsWidget);
