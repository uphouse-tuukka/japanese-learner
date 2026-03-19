<script lang="ts">
import { page } from '$app/stores';
import '../app.css';

let { children } = $props();

const pathname = $derived($page.url.pathname);

function isActive(path: string): boolean {
if (path === '/') return pathname === '/';
return pathname === path || pathname.startsWith(`${path}/`);
}
</script>

<div class="shell">
<header class="header">
<div class="header-inner">
<a href="/" class="title text-japanese">日本語学習</a>

<nav class="nav" aria-label="Main navigation">
<a href="/" class:active={isActive('/')}>ホーム</a>
<a href="/learn" class:active={isActive('/learn')}>学ぶ</a>
<a href="/practice" class:active={isActive('/practice')}>練習</a>
<a href="/history" class:active={isActive('/history')}>履歴</a>
</nav>
</div>
</header>

<main class="main">
<div class="container">
{@render children()}
</div>
</main>

<footer class="footer">
<p>毎日少しずつ学びましょう。</p>
</footer>
</div>

<style>
.shell {
min-height: 100dvh;
display: flex;
flex-direction: column;
}

.header {
position: sticky;
top: 0;
z-index: var(--z-nav);
border-bottom: 1px solid var(--border-light);
background: color-mix(in srgb, var(--bg-shoji) 94%, white);
}

.header-inner {
max-width: var(--content-wide);
margin: 0 auto;
padding: var(--space-3) var(--space-4);
display: flex;
align-items: center;
justify-content: space-between;
gap: var(--space-4);
}

.title {
font-size: var(--text-xl);
font-weight: var(--weight-medium);
letter-spacing: var(--tracking-wider);
color: var(--text-sumi);
text-decoration: none;
}

.nav {
display: flex;
gap: var(--space-2);
flex-wrap: wrap;
}

.nav a {
padding: var(--space-2) var(--space-3);
border-radius: var(--radius-md);
color: var(--text-bokashi);
text-decoration: none;
font-size: var(--text-sm);
}

.nav a.active {
background: var(--accent-shu-wash);
color: var(--accent-shu-deep);
font-weight: var(--weight-medium);
}

.main {
flex: 1;
}

.container {
max-width: var(--content-width);
margin: 0 auto;
padding: var(--space-8) var(--space-4) var(--space-12);
}

.footer {
border-top: 1px solid var(--border-light);
padding: var(--space-4);
text-align: center;
font-size: var(--text-sm);
color: var(--text-usuzumi);
}

@media (max-width: 700px) {
.header-inner {
flex-direction: column;
align-items: flex-start;
}
}
</style>
