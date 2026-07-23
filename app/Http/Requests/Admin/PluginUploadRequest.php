<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates a plugin ZIP upload before it reaches the framework's
 * PluginManager. Mirrors the inline validation the ThemeController does
 * for theme zips: MIME-type gate + a size cap in kilobytes.
 *
 * `application/octet-stream` is accepted because Safari and some
 * command-line clients (curl without --form-string type override) send
 * that instead of `application/zip`; the framework re-validates the
 * MIME with finfo before extracting.
 */
class PluginUploadRequest extends FormRequest
{
    /**
     * Authorization is enforced by the route-level `role:admin`
     * middleware — the controller never runs otherwise.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'plugin' => [
                'required',
                'file',
                'mimetypes:application/zip,application/x-zip-compressed,application/octet-stream',
                'max:'.$this->maxUploadKilobytes(),
            ],
        ];
    }

    /**
     * Framework config is in bytes; Laravel's `max` rule expects
     * kilobytes for file uploads. Round up so a config set to
     * exactly N kilobytes doesn't reject at N-KB uploads.
     */
    private function maxUploadKilobytes(): int
    {
        $bytes = (int) config('cms.plugins.maxUploadSize', 10 * 1024 * 1024);

        return (int) max(1, (int) ceil($bytes / 1024));
    }
}
