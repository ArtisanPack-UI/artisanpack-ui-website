<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Contracts\Foundation\Application;
use RuntimeException;
use Throwable;

/**
 * Minimal `.env` file editor — replaces or appends a single key/value pair
 * while preserving the rest of the file. Used by the `/install` wizard to
 * rotate `KEYSTONE_INSTALL_TOKEN` after a successful provision so the URL
 * the operator shared can never be reused.
 *
 * Resolved through the container so the test suite can rebind it against
 * a temporary file instead of the real `.env`.
 */
class EnvWriter
{
    public function __construct(private string $path) {}

    public static function fromApplication(Application $app): self
    {
        return new self($app->environmentFilePath());
    }

    public function path(): string
    {
        return $this->path;
    }

    public function set(string $key, string $value): void
    {
        $contents = '';

        if (is_file($this->path)) {
            // Cast-to-string would silently swallow a read failure and
            // overwrite the env file with a fresh single-key version,
            // throwing away every other variable. Bail before write.
            $read = file_get_contents($this->path);

            if (false === $read) {
                throw new RuntimeException("Unable to read env file at {$this->path}.");
            }

            $contents = $read;
        }

        $line    = $key.'='.$this->escape($value);
        $pattern = '/^'.preg_quote($key, '/').'=.*$/m';

        if (1 === preg_match($pattern, $contents)) {
            $contents = (string) preg_replace($pattern, $line, $contents, 1);
        } else {
            if ('' !== $contents && ! str_ends_with($contents, "\n")) {
                $contents .= "\n";
            }
            $contents .= $line."\n";
        }

        $this->writeAtomically($contents);
    }

    /**
     * Write to a sibling temp file first, fsync, then atomically rename
     * into place. An in-place truncate-and-write leaves the file in a
     * half-written state if the process dies mid-write, which for an
     * `.env` means losing every variable that came after the cut. The
     * rename is atomic on POSIX so readers see either the full old file
     * or the full new one — never a half of either.
     */
    private function writeAtomically(string $contents): void
    {
        $directory = dirname($this->path);
        $temp      = tempnam($directory, '.env-write-');

        if (false === $temp) {
            throw new RuntimeException("Unable to create temp file in {$directory} for atomic env write.");
        }

        try {
            $handle = fopen($temp, 'wb');

            if (false === $handle) {
                throw new RuntimeException("Unable to open temp file {$temp} for writing.");
            }

            try {
                if (false === fwrite($handle, $contents)) {
                    throw new RuntimeException("Unable to write contents to temp file {$temp}.");
                }

                fflush($handle);
            } finally {
                fclose($handle);
            }

            // Preserve the original file's permissions across the rename
            // so the rotated `.env` doesn't end up world-readable just
            // because tempnam() defaulted to 0600.
            if (is_file($this->path)) {
                $perms = fileperms($this->path);

                if (false !== $perms) {
                    chmod($temp, $perms & 0777);
                }
            }

            if (! rename($temp, $this->path)) {
                throw new RuntimeException("Unable to atomically replace {$this->path}.");
            }
        } catch (Throwable $e) {
            if (is_file($temp)) {
                @unlink($temp);
            }

            throw $e;
        }
    }

    /**
     * Quote values that contain characters dotenv treats specially. Random
     * tokens (alphanumeric) pass through unquoted; anything with whitespace,
     * quotes, hashes, or `=` gets wrapped to avoid mis-parsing.
     */
    private function escape(string $value): string
    {
        if (1 === preg_match('/[\s"#\'=]/', $value)) {
            return '"'.addcslashes($value, '"\\$`').'"';
        }

        return $value;
    }
}
