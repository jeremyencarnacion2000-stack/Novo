# Direct Lemon Squeezy contribution link

For contributors who do not have a Novo account, share:

`https://<novo-host>/api/billing/direct?interval=month`

The route is public and redirects to Lemon Squeezy's hosted checkout. It does
not create or mutate a Novo user; subscription activation remains tied to the
authenticated checkout flow and signed Lemon Squeezy webhook events.

Configure the hosted URLs in the deployment environment:

```text
LEMONSQUEEZY_DIRECT_CHECKOUT_URL_MONTH=https://...
LEMONSQUEEZY_DIRECT_CHECKOUT_URL_YEAR=https://...
```

Never put API keys or webhook secrets in the URL.
