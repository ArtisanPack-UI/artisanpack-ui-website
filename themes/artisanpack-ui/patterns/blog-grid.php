<?php

/**
 * Title: Blog — Grid
 * Slug: artisanpack-ui/blog-grid
 * Categories: featured, text
 * Synced: no
 * Description: Three-column post grid.
 */
?>
<!-- wp:artisanpack/group {"tagName":"section","layout":{"type":"constrained"},"backgroundColor":"section","style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80"}}}} -->
<section class="wp-block-artisanpack-group wp-block-group has-section-background-color has-background" style="padding-top:var(--wp--preset--spacing--80);padding-bottom:var(--wp--preset--spacing--80)">
<!-- wp:artisanpack/paragraph {"style":{"typography":{"fontFamily":"var:preset|font-family|mono","fontSize":"var:preset|font-size|xsmall","letterSpacing":"0.16em","textTransform":"uppercase"}},"textColor":"text-muted"} -->
<p class="has-text-muted-color has-text-color" style="font-family:var(--wp--preset--font-family--mono);font-size:var(--wp--preset--font-size--xsmall);letter-spacing:0.16em;text-transform:uppercase">Latest posts</p>
<!-- /wp:artisanpack/paragraph -->

<!-- wp:artisanpack/heading {"level":2,"textAlign":"center","className":"","style":{"typography":{"fontFamily":"var:preset|font-family|display","fontWeight":"600","letterSpacing":"-0.02em","lineHeight":"1.15"}}} -->
<h2 class="wp-block-heading has-text-align-center" style="font-family:var(--wp--preset--font-family--display);font-weight:600;letter-spacing:-0.02em;line-height:1.15">From the blog</h2>
<!-- /wp:artisanpack/heading -->

<!-- wp:artisanpack/spacer {"height":"30px"} -->
<div style="height:30px" aria-hidden="true" class="wp-block-artisanpack-spacer wp-block-spacer"></div>
<!-- /wp:artisanpack/spacer -->

<!-- wp:artisanpack/query {"queryId":0,"query":{"perPage":3,"postType":"post","inherit":false},"layout":{"type":"constrained"}} -->
<div class="wp-block-artisanpack-query wp-block-query"><!-- wp:artisanpack/post-template {"layout":{"type":"grid","columnCount":3}} -->
<!-- wp:artisanpack/post-featured-image {"style":{"border":{"radius":"12px"}}} /-->
<!-- wp:artisanpack/post-title {"level":3,"isLink":true} /-->
<!-- wp:artisanpack/post-excerpt /-->
<!-- wp:artisanpack/post-date {"textColor":"text-muted"} /-->
<!-- /wp:artisanpack/post-template --></div>
<!-- /wp:artisanpack/query -->
</section>
<!-- /wp:artisanpack/group -->
