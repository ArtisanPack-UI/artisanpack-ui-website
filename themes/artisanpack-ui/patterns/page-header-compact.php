<?php

/**
 * Title: Page Header — Compact
 * Slug: artisanpack-ui/page-header-compact
 * Categories: header, text
 * Synced: no
 * Description: Breadcrumb + inline title + action bar.
 */
?>
<!-- wp:artisanpack/group {"tagName":"section","layout":{"type":"constrained"},"style":{"spacing":{"padding":{"top":"var:preset|spacing|50","bottom":"var:preset|spacing|30"}}}} -->
<section class="wp-block-artisanpack-group wp-block-group " style="padding-top:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--30)">
<!-- wp:artisanpack/breadcrumbs {"separatorIcon":"chevron-right","textColor":"text-muted","style":{"typography":{"fontFamily":"var:preset|font-family|mono","fontSize":"var:preset|font-size|xsmall","letterSpacing":"0.16em","textTransform":"uppercase"}}} /-->

<!-- wp:artisanpack/heading {"level":1,"className":"","style":{"typography":{"fontFamily":"var:preset|font-family|display","fontWeight":"600","letterSpacing":"-0.02em","lineHeight":"1.15"}}} -->
<h1 class="wp-block-heading" style="font-family:var(--wp--preset--font-family--display);font-weight:600;letter-spacing:-0.02em;line-height:1.15">Compact title</h1>
<!-- /wp:artisanpack/heading -->

<!-- wp:artisanpack/buttons {"layout":{"type":"flex"}} -->
<div class="wp-block-artisanpack-buttons wp-block-buttons is-layout-flex">
<!-- wp:artisanpack/button -->
<div class="wp-block-artisanpack-button wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Primary action</a></div>
<!-- /wp:artisanpack/button -->

<!-- wp:artisanpack/button -->
<div class="wp-block-artisanpack-button wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Secondary action</a></div>
<!-- /wp:artisanpack/button -->
</div>
<!-- /wp:artisanpack/buttons -->
</section>
<!-- /wp:artisanpack/group -->
