<?php

/**
 * Title: Hero — Split
 * Slug: artisanpack-ui/hero-split
 * Categories: featured, hero
 * Synced: no
 * Description: Two-column hero: copy left, media right.
 */
?>
<!-- wp:artisanpack/group {"tagName":"section","layout":{"type":"constrained"},"style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80"}}}} -->
<section class="wp-block-artisanpack-group wp-block-group " style="padding-top:var(--wp--preset--spacing--80);padding-bottom:var(--wp--preset--spacing--80)">
<!-- wp:artisanpack/columns -->
<div class="wp-block-artisanpack-columns wp-block-columns">
<!-- wp:artisanpack/column -->
<div class="wp-block-artisanpack-column wp-block-column">
<!-- wp:artisanpack/heading {"level":1,"className":"","style":{"typography":{"fontFamily":"var:preset|font-family|display","fontWeight":"600","letterSpacing":"-0.02em","lineHeight":"1.15"}}} -->
<h1 class="wp-block-heading" style="font-family:var(--wp--preset--font-family--display);font-weight:600;letter-spacing:-0.02em;line-height:1.15">Split hero title</h1>
<!-- /wp:artisanpack/heading -->

<!-- wp:artisanpack/paragraph {"textColor":"text-muted","style":{"typography":{"lineHeight":"1.65"}}} -->
<p class="has-text-muted-color has-text-color" style="line-height:1.65">Lead paragraph in the left column. Two calls to action below.</p>
<!-- /wp:artisanpack/paragraph -->

<!-- wp:artisanpack/buttons {"layout":{"type":"flex"}} -->
<div class="wp-block-artisanpack-buttons wp-block-buttons is-layout-flex">
<!-- wp:artisanpack/button -->
<div class="wp-block-artisanpack-button wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Primary</a></div>
<!-- /wp:artisanpack/button -->

<!-- wp:artisanpack/button -->
<div class="wp-block-artisanpack-button wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Secondary</a></div>
<!-- /wp:artisanpack/button -->
</div>
<!-- /wp:artisanpack/buttons -->
</div>
<!-- /wp:artisanpack/column -->

<!-- wp:artisanpack/column -->
<div class="wp-block-artisanpack-column wp-block-column">
<!-- wp:artisanpack/image {"align":"right","sizeSlug":"large","className":"is-style-default"} -->
<figure class="wp-block-image alignright size-large"><!-- TODO: media_id for hero-wide image --><img alt="Product screenshot"/></figure>
<!-- /wp:artisanpack/image -->
</div>
<!-- /wp:artisanpack/column -->
</div>
<!-- /wp:artisanpack/columns -->
</section>
<!-- /wp:artisanpack/group -->
