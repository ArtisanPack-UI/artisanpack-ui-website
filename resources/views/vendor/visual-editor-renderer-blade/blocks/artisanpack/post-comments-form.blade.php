{{--
    Keystone override of the vendor `artisanpack/post-comments-form`
    block. Same markup as the upstream partial at
    vendor/artisanpack-ui/visual-editor/packages/visual-editor-renderer-blade/resources/views/blocks/artisanpack/post-comments-form.blade.php,
    but wrapped in `keystone.public.commentForm.before` / `.after`
    action hooks so plugins can inject reCAPTCHA, honeypots, or
    replacement markup immediately adjacent to the rendered form —
    the WordPress `comment_form_before` / `comment_form_after`
    analog. Keep this file in sync with the vendor original.
--}}
@php
    use ArtisanPackUI\VisualEditorRendererBlade\Support\BlockSupports;
    use ArtisanPackUI\VisualEditorRendererBlade\Support\UrlSanitizer;

    $defaultAction = isset($attributes['_resolvedFormAction']) && is_string($attributes['_resolvedFormAction'])
        ? $attributes['_resolvedFormAction']
        : '/api/v1/comments';
    if (function_exists('applyFilters')) {
        $defaultAction = (string) applyFilters('comments.form.action', $defaultAction);
    }
    $formAction = UrlSanitizer::safe($defaultAction);
@endphp
@action('keystone.public.commentForm.before')
<div{!! BlockSupports::wrapperAttrs($attributes, ['wp-block-post-comments-form', 'comment-respond']) !!}>
    <h3 class="comment-reply-title">{{ __('Leave a Comment') }}</h3>
    <form action="{{ $formAction }}" method="post" class="comment-form">
        @if (function_exists('csrf_field'))
            {!! csrf_field() !!}
        @endif
        @isset($attributes['_resolvedPostId'])
            <input type="hidden" name="post_id" value="{{ (int) $attributes['_resolvedPostId'] }}" />
        @endisset
        <p class="comment-form-author">
            <label for="comment-author">{{ __('Name') }} <span aria-hidden="true">*</span></label>
            <input id="comment-author" name="author_name" type="text" autocomplete="name" required />
        </p>
        <p class="comment-form-email">
            <label for="comment-email">{{ __('Email') }} <span aria-hidden="true">*</span></label>
            <input id="comment-email" name="author_email" type="email" autocomplete="email" required />
        </p>
        <p class="comment-form-url">
            <label for="comment-url">{{ __('Website') }}</label>
            <input id="comment-url" name="author_url" type="url" autocomplete="url" />
        </p>
        <p class="comment-form-comment">
            <label for="comment-content">{{ __('Comment') }} <span aria-hidden="true">*</span></label>
            <textarea id="comment-content" name="content" rows="6" required></textarea>
        </p>
        <p class="form-submit">
            {{-- Deliberately no `name="submit"` on the input — that
                 attribute shadows the form's `.submit` property in
                 the DOM and breaks any JS that hooks the form
                 (analytics, validation libraries, etc.). The
                 value isn't read server-side either. --}}
            <input type="submit" class="submit" value="{{ __('Post Comment') }}" />
        </p>
    </form>
</div>
@action('keystone.public.commentForm.after')
