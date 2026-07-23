<?php

/**
 * Title: Hero — Terminal
 * Slug: artisanpack-ui/hero-terminal
 * Categories: featured, hero
 * Synced: no
 * Description: Hero with a terminal-styled code block.
 */
?>
<!-- wp:artisanpack/group {"tagName":"section","layout":{"type":"constrained"},"className":"ap-starfield","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}}} -->
<section class="wp-block-artisanpack-group wp-block-group ap-starfield" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)">
<!-- wp:artisanpack/heading {"level":1,"textAlign":"center","className":"","style":{"typography":{"fontFamily":"var:preset|font-family|display","fontWeight":"600","letterSpacing":"-0.02em","lineHeight":"1.15"}}} -->
<h1 class="wp-block-heading has-text-align-center" style="font-family:var(--wp--preset--font-family--display);font-weight:600;letter-spacing:-0.02em;line-height:1.15">Built for the terminal</h1>
<!-- /wp:artisanpack/heading -->

<!-- wp:artisanpack/paragraph {"textColor":"text-muted","align":"center","style":{"typography":{"lineHeight":"1.65"}}} -->
<p class="has-text-muted-color has-text-color has-text-align-center" style="line-height:1.65">Run one command to install.</p>
<!-- /wp:artisanpack/paragraph -->

<!-- wp:artisanpack/code {"className":"is-style-terminal"} -->
<pre class="wp-block-code is-style-terminal"><code>$ composer require artisanpack-ui/cms-framework
$ php artisan cms:install</code></pre>
<!-- /wp:artisanpack/code -->
</section>
<!-- /wp:artisanpack/group -->
