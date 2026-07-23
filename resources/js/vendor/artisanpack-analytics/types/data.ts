/**
 * TypeScript interfaces for ArtisanPack Analytics Data Transfer Objects.
 *
 * These mirror the PHP DTOs in `src/Data/` and represent the shapes
 * returned by their `toArray()` methods.
 */

import type { DeviceType } from './enums';

// --- DateRange (src/Data/DateRange.php) ---

export interface DateRange {
    start_date: string;
    end_date: string;
}

// --- DeviceInfo (src/Data/DeviceInfo.php) ---

export interface DeviceInfo {
    device_type: DeviceType;
    browser: string | null;
    browser_version: string | null;
    os: string | null;
    os_version: string | null;
    is_bot: boolean;
}

// --- EventData (src/Data/EventData.php) ---

export interface EventData {
    name: string;
    properties: Record<string, unknown> | null;
    session_id: string | null;
    visitor_id: string | null;
    path: string | null;
    ip_address: string | null;
    user_agent: string | null;
    value: number | null;
    category: string | null;
    action: string | null;
    label: string | null;
    source_package: string | null;
    page_view_id: number | null;
    tenant_id: string | number | null;
    site_id: number | null;
}

// --- PageViewData (src/Data/PageViewData.php) ---

export interface PageViewData {
    path: string;
    title: string | null;
    referrer: string | null;
    session_id: string | null;
    visitor_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    country: string | null;
    device_type: DeviceType | null;
    browser: string | null;
    browser_version: string | null;
    os: string | null;
    os_version: string | null;
    screen_width: string | null;
    screen_height: string | null;
    viewport_width: string | null;
    viewport_height: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    load_time: number | null;
    custom_data: Record<string, unknown> | null;
    tenant_id: string | number | null;
    site_id: number | null;
}

// --- SessionData (src/Data/SessionData.php) ---

export interface SessionData {
    visitor_id: string;
    session_id: string | null;
    entry_path: string | null;
    referrer: string | null;
    ip_address: string | null;
    user_agent: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    tenant_id: string | number | null;
}

// --- VisitorData (src/Data/VisitorData.php) ---

export interface VisitorData {
    user_agent: string | null;
    ip_address: string | null;
    screen_resolution: string | null;
    timezone: string | null;
    language: string | null;
    country: string | null;
    device_type: DeviceType | null;
    browser: string | null;
    browser_version: string | null;
    os: string | null;
    os_version: string | null;
    existing_id: string | null;
    tenant_id: string | number | null;
}
