<?php

declare(strict_types=1);

namespace Modules\Installer\Support;

/**
 * Sample data backing the Keystone admin shell.
 *
 * Hydrates each page in the design port with the same shape the design app
 * uses so the chrome can be exercised end-to-end before the real CMS models
 * land. Once the backend is wired up, callers will swap this for live queries.
 */
final class KeystoneSampleData
{
    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        return [
            'me'                     => self::me(),
            'site'                   => self::site(),
            'kpis'                   => self::kpis(),
            'revenue_series'         => self::revenueSeries(),
            'traffic_sources'        => self::trafficSources(),
            'recent_orders'          => self::recentOrders(),
            'recent_leads'           => self::recentLeads(),
            'pages'                  => self::pages(),
            'posts'                  => self::posts(),
            'media'                  => self::media(),
            'products'               => self::products(),
            'customers'              => self::customers(),
            'forms'                  => self::forms(),
            'users'                  => self::users(),
            'integrations'           => self::integrations(),
            'activity_log'           => self::activityLog(),
            'notifications'          => self::notifications(),
            'order_status_breakdown' => self::orderStatusBreakdown(),
            'lead_funnel'            => self::leadFunnel(),
        ];
    }

    /**
     * @return array<string, string|null>
     */
    public static function me(): array
    {
        return [
            'name'      => 'Jacob Martella',
            'email'     => 'jacob@jmwd.dev',
            'handle'    => 'jmwd',
            'role'      => 'Owner',
            'initials'  => 'JM',
            'photo_url' => null,
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function site(): array
    {
        return [
            'name'           => 'Harbor & Pine Studios',
            'url'            => 'https://harborandpine.com',
            'environment'    => 'production',
            'last_published' => '2026-04-24T15:42:00-04:00',
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function kpis(): array
    {
        return [
            ['label' => 'Revenue (30d)', 'value' => 48230, 'format' => 'currency', 'delta' => 12.4, 'delta_label' => 'vs prev 30d'],
            ['label' => 'Orders (30d)', 'value' => 312, 'format' => 'number', 'delta' => 8.1, 'delta_label' => 'vs prev 30d'],
            ['label' => 'New Leads (30d)', 'value' => 187, 'format' => 'number', 'delta' => 22.6, 'delta_label' => 'vs prev 30d'],
            ['label' => 'Avg Order Value', 'value' => 154.5, 'format' => 'currency', 'delta' => -2.3, 'delta_label' => 'vs prev 30d'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function revenueSeries(): array
    {
        return [
            'categories' => ['Mar 25', 'Mar 28', 'Mar 31', 'Apr 3', 'Apr 6', 'Apr 9', 'Apr 12', 'Apr 15', 'Apr 18', 'Apr 21', 'Apr 24'],
            'series'     => [
                ['name' => 'This period', 'data' => [3200, 3890, 4120, 3970, 4560, 5240, 4890, 5420, 5890, 6210, 6540]],
                ['name' => 'Previous', 'data' => [2900, 3210, 3580, 3640, 3820, 4080, 4310, 4520, 4670, 4830, 5040]],
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function trafficSources(): array
    {
        return [
            ['source' => 'Organic search', 'visitors' => 8420, 'percent' => 41.2],
            ['source' => 'Direct', 'visitors' => 4180, 'percent' => 20.5],
            ['source' => 'Paid social', 'visitors' => 3260, 'percent' => 16.0],
            ['source' => 'Referral', 'visitors' => 2540, 'percent' => 12.4],
            ['source' => 'Email', 'visitors' => 2010, 'percent' => 9.9],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function recentOrders(): array
    {
        return [
            ['id' => '#K-10428', 'customer' => 'Maya Albright', 'total' => 248.0, 'status' => 'paid', 'placed_at' => '2026-04-25T08:15:00-04:00', 'items' => 3],
            ['id' => '#K-10427', 'customer' => 'Rohan Sethi', 'total' => 89.5, 'status' => 'fulfilled', 'placed_at' => '2026-04-25T07:42:00-04:00', 'items' => 1],
            ['id' => '#K-10426', 'customer' => 'Cameron Pine', 'total' => 412.75, 'status' => 'paid', 'placed_at' => '2026-04-24T22:08:00-04:00', 'items' => 5],
            ['id' => '#K-10425', 'customer' => 'Eliza Park', 'total' => 64.0, 'status' => 'refunded', 'placed_at' => '2026-04-24T19:30:00-04:00', 'items' => 1],
            ['id' => '#K-10424', 'customer' => 'Jamal Ortiz', 'total' => 156.0, 'status' => 'paid', 'placed_at' => '2026-04-24T16:54:00-04:00', 'items' => 2],
            ['id' => '#K-10423', 'customer' => 'Priya Shah', 'total' => 322.0, 'status' => 'pending', 'placed_at' => '2026-04-24T15:11:00-04:00', 'items' => 4],
            ['id' => '#K-10422', 'customer' => 'Theo Walker', 'total' => 98.5, 'status' => 'fulfilled', 'placed_at' => '2026-04-24T14:02:00-04:00', 'items' => 2],
            ['id' => '#K-10421', 'customer' => 'Aiden Cho', 'total' => 178.25, 'status' => 'paid', 'placed_at' => '2026-04-24T11:38:00-04:00', 'items' => 2],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function recentLeads(): array
    {
        return [
            ['id' => 1, 'name' => 'Dani Park', 'email' => 'dani@emberbakery.co', 'form' => 'Contact us', 'company' => 'Ember Bakery Co.', 'received_at' => '2026-04-25T09:14:00-04:00', 'status' => 'new'],
            ['id' => 2, 'name' => 'Marcus Bell', 'email' => 'marcus@cedarcollective.com', 'form' => 'Quote request', 'company' => 'Cedar Collective', 'received_at' => '2026-04-25T08:41:00-04:00', 'status' => 'new'],
            ['id' => 3, 'name' => 'Ivy Rourke', 'email' => 'ivy@rourkeandsons.com', 'form' => 'Newsletter', 'company' => 'Rourke & Sons Plumbing', 'received_at' => '2026-04-24T17:22:00-04:00', 'status' => 'contacted'],
            ['id' => 4, 'name' => 'Lena Choi', 'email' => 'lena@harborandpine.com', 'form' => 'Demo request', 'company' => 'Harbor & Pine Studios', 'received_at' => '2026-04-24T13:08:00-04:00', 'status' => 'qualified'],
            ['id' => 5, 'name' => 'Ben Okafor', 'email' => 'ben@lakeshorelegal.com', 'form' => 'Contact us', 'company' => 'Lakeshore Legal', 'received_at' => '2026-04-23T16:50:00-04:00', 'status' => 'qualified'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function pages(): array
    {
        return [
            ['id' => 1, 'title' => 'Home', 'slug' => '/', 'status' => 'published', 'updated_at' => '2026-04-22T11:14:00-04:00', 'author' => 'Jacob Martella', 'views' => 12480],
            ['id' => 2, 'title' => 'About us', 'slug' => '/about', 'status' => 'published', 'updated_at' => '2026-04-18T09:35:00-04:00', 'author' => 'Jacob Martella', 'views' => 4210],
            ['id' => 3, 'title' => 'Services', 'slug' => '/services', 'status' => 'published', 'updated_at' => '2026-04-15T15:42:00-04:00', 'author' => 'Lena Choi', 'views' => 6890],
            ['id' => 4, 'title' => 'Pricing', 'slug' => '/pricing', 'status' => 'draft', 'updated_at' => '2026-04-25T07:50:00-04:00', 'author' => 'Jacob Martella', 'views' => 0],
            ['id' => 5, 'title' => 'Contact', 'slug' => '/contact', 'status' => 'published', 'updated_at' => '2026-04-12T14:20:00-04:00', 'author' => 'Jacob Martella', 'views' => 2340],
            ['id' => 6, 'title' => 'Spring Lookbook 2026', 'slug' => '/spring-2026', 'status' => 'scheduled', 'updated_at' => '2026-04-20T10:00:00-04:00', 'author' => 'Lena Choi', 'views' => 0],
            ['id' => 7, 'title' => 'Privacy policy', 'slug' => '/privacy', 'status' => 'published', 'updated_at' => '2026-02-08T11:00:00-04:00', 'author' => 'Jacob Martella', 'views' => 320],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function posts(): array
    {
        return [
            ['id' => 1, 'title' => 'Why we redesigned our checkout (and what we learned)', 'slug' => 'redesigned-checkout', 'status' => 'published', 'category' => 'Behind the scenes', 'published_at' => '2026-04-22T09:00:00-04:00', 'author' => 'Jacob Martella', 'comments' => 14],
            ['id' => 2, 'title' => '5 ways to improve your storefront copy this week', 'slug' => 'storefront-copy-tips', 'status' => 'published', 'category' => 'Marketing', 'published_at' => '2026-04-15T08:30:00-04:00', 'author' => 'Lena Choi', 'comments' => 8],
            ['id' => 3, 'title' => 'Spring 2026 release notes', 'slug' => 'spring-2026-release-notes', 'status' => 'draft', 'category' => 'Product', 'published_at' => null, 'author' => 'Jacob Martella', 'comments' => 0],
            ['id' => 4, 'title' => 'How to choose colors that convert', 'slug' => 'colors-that-convert', 'status' => 'scheduled', 'category' => 'Marketing', 'published_at' => '2026-04-29T08:00:00-04:00', 'author' => 'Lena Choi', 'comments' => 0],
            ['id' => 5, 'title' => 'Building a CMS-first business in 2026', 'slug' => 'cms-first-business', 'status' => 'published', 'category' => 'Strategy', 'published_at' => '2026-04-08T10:00:00-04:00', 'author' => 'Jacob Martella', 'comments' => 27],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function products(): array
    {
        return [
            ['id' => 1, 'name' => 'Cedar Mug — Slate', 'sku' => 'CDR-MUG-SLT', 'price' => 28.0, 'inventory' => 142, 'status' => 'active', 'updated_at' => '2026-04-24T11:00:00-04:00'],
            ['id' => 2, 'name' => 'Pine Tee — Heather', 'sku' => 'PNE-TEE-HTH', 'price' => 36.0, 'inventory' => 88, 'status' => 'active', 'updated_at' => '2026-04-23T14:42:00-04:00'],
            ['id' => 3, 'name' => 'Harbor Tote — Natural', 'sku' => 'HBR-TOT-NAT', 'price' => 48.0, 'inventory' => 12, 'status' => 'low_stock', 'updated_at' => '2026-04-22T09:18:00-04:00'],
            ['id' => 4, 'name' => 'Spring 2026 Bundle', 'sku' => 'BDL-SPR-2026', 'price' => 124.0, 'inventory' => 35, 'status' => 'active', 'updated_at' => '2026-04-21T16:50:00-04:00'],
            ['id' => 5, 'name' => 'Pine Cap — Stone', 'sku' => 'PNE-CAP-STN', 'price' => 32.0, 'inventory' => 0, 'status' => 'out_of_stock', 'updated_at' => '2026-04-20T08:05:00-04:00'],
            ['id' => 6, 'name' => 'Lookbook 2026 (PDF)', 'sku' => 'LBK-2026-PDF', 'price' => 0.0, 'inventory' => null, 'status' => 'draft', 'updated_at' => '2026-04-19T12:30:00-04:00'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function customers(): array
    {
        return [
            ['id' => 1, 'name' => 'Maya Albright', 'email' => 'maya@hello.co', 'orders' => 7, 'lifetime' => 1248.5, 'last_seen' => '2026-04-25T08:15:00-04:00'],
            ['id' => 2, 'name' => 'Rohan Sethi', 'email' => 'rohan@studio.io', 'orders' => 3, 'lifetime' => 312.0, 'last_seen' => '2026-04-25T07:42:00-04:00'],
            ['id' => 3, 'name' => 'Cameron Pine', 'email' => 'cam@pinegarden.com', 'orders' => 12, 'lifetime' => 3210.0, 'last_seen' => '2026-04-24T22:08:00-04:00'],
            ['id' => 4, 'name' => 'Eliza Park', 'email' => 'eliza@park.dev', 'orders' => 1, 'lifetime' => 64.0, 'last_seen' => '2026-04-24T19:30:00-04:00'],
            ['id' => 5, 'name' => 'Jamal Ortiz', 'email' => 'jamal@northstar.co', 'orders' => 5, 'lifetime' => 842.5, 'last_seen' => '2026-04-24T16:54:00-04:00'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function forms(): array
    {
        return [
            ['id' => 1, 'name' => 'Contact us', 'submissions' => 87, 'conversion' => 3.4, 'last_submission' => '2026-04-25T09:14:00-04:00', 'status' => 'active'],
            ['id' => 2, 'name' => 'Newsletter', 'submissions' => 412, 'conversion' => 8.1, 'last_submission' => '2026-04-25T07:55:00-04:00', 'status' => 'active'],
            ['id' => 3, 'name' => 'Quote request', 'submissions' => 34, 'conversion' => 1.8, 'last_submission' => '2026-04-25T08:41:00-04:00', 'status' => 'active'],
            ['id' => 4, 'name' => 'Demo request', 'submissions' => 22, 'conversion' => 1.1, 'last_submission' => '2026-04-25T08:08:00-04:00', 'status' => 'active'],
            ['id' => 5, 'name' => 'Spring promo opt-in', 'submissions' => 158, 'conversion' => 4.6, 'last_submission' => '2026-04-23T18:02:00-04:00', 'status' => 'paused'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function users(): array
    {
        return [
            ['id' => 1, 'name' => 'Jacob Martella', 'email' => 'jacob@jmwd.dev', 'role' => 'Owner', 'last_active' => '2026-04-25T09:18:00-04:00', 'status' => 'active'],
            ['id' => 2, 'name' => 'Lena Choi', 'email' => 'lena@harborandpine.com', 'role' => 'Editor', 'last_active' => '2026-04-25T08:42:00-04:00', 'status' => 'active'],
            ['id' => 3, 'name' => 'Marcus Bell', 'email' => 'marcus@cedarcollective.com', 'role' => 'Author', 'last_active' => '2026-04-24T17:10:00-04:00', 'status' => 'active'],
            ['id' => 4, 'name' => 'Rita Vos', 'email' => 'rita@northfield.co', 'role' => 'Editor', 'last_active' => '2026-04-22T11:32:00-04:00', 'status' => 'active'],
            ['id' => 5, 'name' => 'Dani Park', 'email' => 'dani@emberbakery.co', 'role' => 'Viewer', 'last_active' => '2026-04-15T09:08:00-04:00', 'status' => 'invited'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function integrations(): array
    {
        return [
            ['id' => 1, 'name' => 'Stripe', 'category' => 'Payments', 'status' => 'connected', 'connected_by' => 'Jacob Martella', 'connected_at' => '2026-01-12T10:00:00-04:00'],
            ['id' => 2, 'name' => 'Mailchimp', 'category' => 'Email marketing', 'status' => 'connected', 'connected_by' => 'Jacob Martella', 'connected_at' => '2026-02-04T14:32:00-04:00'],
            ['id' => 3, 'name' => 'Google Analytics 4', 'category' => 'Analytics', 'status' => 'connected', 'connected_by' => 'Jacob Martella', 'connected_at' => '2026-01-18T09:14:00-04:00'],
            ['id' => 4, 'name' => 'Cloudflare', 'category' => 'CDN / DNS', 'status' => 'connected', 'connected_by' => 'Jacob Martella', 'connected_at' => '2026-01-12T10:05:00-04:00'],
            ['id' => 5, 'name' => 'Shippo', 'category' => 'Shipping', 'status' => 'available', 'connected_by' => null, 'connected_at' => null],
            ['id' => 6, 'name' => 'Klaviyo', 'category' => 'Email marketing', 'status' => 'available', 'connected_by' => null, 'connected_at' => null],
            ['id' => 7, 'name' => 'Slack', 'category' => 'Notifications', 'status' => 'error', 'connected_by' => 'Jacob Martella', 'connected_at' => '2026-03-02T08:40:00-04:00'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function activityLog(): array
    {
        return [
            ['id' => 1, 'actor' => 'Jacob Martella', 'action' => 'published the page', 'target' => 'Spring Lookbook 2026', 'at' => '2026-04-25T09:18:00-04:00'],
            ['id' => 2, 'actor' => 'Lena Choi', 'action' => 'updated the post', 'target' => 'How to choose colors that convert', 'at' => '2026-04-25T08:42:00-04:00'],
            ['id' => 3, 'actor' => 'System', 'action' => 'fulfilled order', 'target' => '#K-10422', 'at' => '2026-04-24T14:02:00-04:00'],
            ['id' => 4, 'actor' => 'Marcus Bell', 'action' => 'uploaded media', 'target' => 'product-cedar-mug.jpg', 'at' => '2026-04-23T11:08:00-04:00'],
            ['id' => 5, 'actor' => 'Jacob Martella', 'action' => 'changed product price', 'target' => 'Cedar Mug — Slate', 'at' => '2026-04-22T11:00:00-04:00'],
            ['id' => 6, 'actor' => 'System', 'action' => 'flagged low stock', 'target' => 'Harbor Tote — Natural', 'at' => '2026-04-22T09:18:00-04:00'],
            ['id' => 7, 'actor' => 'Rita Vos', 'action' => 'invited user', 'target' => 'dani@emberbakery.co', 'at' => '2026-04-15T09:08:00-04:00'],
            ['id' => 8, 'actor' => 'Jacob Martella', 'action' => 'connected integration', 'target' => 'Slack', 'at' => '2026-03-02T08:40:00-04:00'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function notifications(): array
    {
        return [
            ['id' => 1, 'title' => 'New high-value order', 'message' => 'Cameron Pine placed a $412.75 order — 5 items.', 'kind' => 'order', 'created_at' => '2026-04-25T09:20:00-04:00', 'read' => false],
            ['id' => 2, 'title' => 'Low stock alert', 'message' => 'Harbor Tote — Natural is down to 12 units.', 'kind' => 'inventory', 'created_at' => '2026-04-25T09:05:00-04:00', 'read' => false],
            ['id' => 3, 'title' => 'New lead from Quote request', 'message' => 'Dani Park (Ember Bakery Co.) submitted a quote request.', 'kind' => 'lead', 'created_at' => '2026-04-25T09:14:00-04:00', 'read' => false],
            ['id' => 4, 'title' => 'Slack integration error', 'message' => 'Token expired — re-authenticate to keep notifications flowing.', 'kind' => 'system', 'created_at' => '2026-04-25T07:30:00-04:00', 'read' => false],
            ['id' => 5, 'title' => 'Page published', 'message' => 'Lena Choi published "Spring Lookbook 2026".', 'kind' => 'content', 'created_at' => '2026-04-24T15:42:00-04:00', 'read' => true],
            ['id' => 6, 'title' => 'Refund processed', 'message' => 'Order #K-10425 was refunded ($64.00).', 'kind' => 'order', 'created_at' => '2026-04-24T19:34:00-04:00', 'read' => true],
            ['id' => 7, 'title' => 'New comment on blog post', 'message' => 'Maya Albright commented on "Why we redesigned our checkout".', 'kind' => 'content', 'created_at' => '2026-04-24T13:20:00-04:00', 'read' => true],
            ['id' => 8, 'title' => 'Weekly traffic report ready', 'message' => 'Sessions up 12.4% week-over-week. View report →', 'kind' => 'reports', 'created_at' => '2026-04-22T08:00:00-04:00', 'read' => true],
            ['id' => 9, 'title' => 'New user invitation accepted', 'message' => 'Rita Vos joined as Editor.', 'kind' => 'system', 'created_at' => '2026-04-22T11:32:00-04:00', 'read' => true],
            ['id' => 10, 'title' => 'GA4 sync complete', 'message' => '7-day rolling sync finished — 4 new audiences imported.', 'kind' => 'system', 'created_at' => '2026-04-21T03:00:00-04:00', 'read' => true],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function orderStatusBreakdown(): array
    {
        return [
            ['label' => 'Paid', 'value' => 184],
            ['label' => 'Fulfilled', 'value' => 96],
            ['label' => 'Pending', 'value' => 24],
            ['label' => 'Refunded', 'value' => 8],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function leadFunnel(): array
    {
        return [
            ['label' => 'Visitors', 'value' => 20410],
            ['label' => 'Engaged', 'value' => 4280],
            ['label' => 'Leads', 'value' => 187],
            ['label' => 'Qualified', 'value' => 64],
            ['label' => 'Customers', 'value' => 18],
        ];
    }
}
