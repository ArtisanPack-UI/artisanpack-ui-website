<?php

/**
 * Title: Hero — Image
 * Slug: artisanpack-ui/hero-image
 * Categories: featured, hero
 * Synced: no
 * Description: Full-bleed image with overlay title.
 */
?>
<!-- wp:artisanpack/group {"tagName":"section","layout":{"type":"constrained"},"style":{"spacing":{"padding":{"top":"var:preset|spacing|0","bottom":"var:preset|spacing|0"}}}} -->
<section class="wp-block-artisanpack-group wp-block-group " style="padding-top:var(--wp--preset--spacing--0);padding-bottom:var(--wp--preset--spacing--0)">
<!-- wp:artisanpack/cover {"overlayColor":"ink","dimRatio":60,"minHeight":600,"layout":{"type":"constrained"}} -->
<div class="wp-block-cover"><span aria-hidden="true" class="wp-block-cover__background has-ink-background-color has-background-dim-60 has-background-dim"></span><!-- TODO: media_id for hero-wide image --><div class="wp-block-cover__inner-container">
<!-- wp:artisanpack/heading {"level":1,"textAlign":"center","className":"","style":{"typography":{"fontFamily":"var:preset|font-family|display","fontWeight":"600","letterSpacing":"-0.02em","lineHeight":"1.15"}}} -->
<h1 class="wp-block-heading has-text-align-center" style="font-family:var(--wp--preset--font-family--display);font-weight:600;letter-spacing:-0.02em;line-height:1.15">Image hero title</h1>
<!-- /wp:artisanpack/heading -->

<!-- wp:artisanpack/paragraph {"textColor":"text","align":"center","style":{"typography":{"lineHeight":"1.65"}}} -->
<p class="has-text-color has-text-color has-text-align-center" style="line-height:1.65">Overlay copy on a full-bleed image background.</p>
<!-- /wp:artisanpack/paragraph -->
</div></div>
<!-- /wp:artisanpack/cover -->
</section>
<!-- /wp:artisanpack/group -->
