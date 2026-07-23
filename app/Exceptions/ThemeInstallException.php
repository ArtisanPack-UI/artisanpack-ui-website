<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;

/**
 * Thrown by ThemeInstaller when an uploaded theme zip cannot be safely
 * extracted or fails validation. The exception message is intended to be
 * user-facing — surfaced as an inline upload error in the admin UI.
 */
class ThemeInstallException extends Exception
{
    public static function unreadableZip(): self
    {
        return new self(__('The uploaded file could not be opened as a zip archive.'));
    }

    public static function unsafeEntry(string $name): self
    {
        return new self(__('The zip contains an unsafe path: :name', ['name' => $name]));
    }

    public static function tooLarge(): self
    {
        return new self(__('The zip is too large or contains too many files.'));
    }

    public static function missingManifest(): self
    {
        return new self(__('No theme.json was found in the zip.'));
    }

    public static function invalidManifest(string $reason): self
    {
        return new self(__('theme.json is invalid: :reason', ['reason' => $reason]));
    }

    public static function manifestSchemaFailed(string $offendingKey, string $message): self
    {
        return new self(__('theme.json failed schema validation at :key: :message', [
            'key'     => $offendingKey,
            'message' => $message,
        ]));
    }

    public static function alreadyInstalled(string $slug): self
    {
        return new self(__('A theme with slug ":slug" is already installed.', ['slug' => $slug]));
    }
}
