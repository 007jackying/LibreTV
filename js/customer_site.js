// Custom site extension point.
// Add your own API sources here and they will be merged into the global API_SITES.
// Each entry must have: api (URL), name (display name), and optionally detail (URL).
// Mark adult sources with: adult: true
//
// Example:
// const CUSTOMER_SITES = {
//     mysite: {
//         api: 'https://example.com/api.php/provide/vod',
//         name: '我的资源站',
//     }
// };
// if (window.extendAPISites) window.extendAPISites(CUSTOMER_SITES);

const CUSTOMER_SITES = {};

if (Object.keys(CUSTOMER_SITES).length && window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
}
