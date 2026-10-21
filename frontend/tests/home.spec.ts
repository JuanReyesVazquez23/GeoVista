import { test, expect } from '@playwright/test';

test.describe('GeoVista', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero muestra título y botón Explorar', async ({ page }) => {
    await test.step('Verificar encabezado y CTA', async () => {
      await expect(page.getByRole('heading', { name: /descubre el mundo/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /explorar/i }).first()).toBeVisible();
    });

    await test.step('Verificar contador de destinos', async () => {
      await expect(page.getByText('45 destinos alrededor del mundo')).toBeVisible();
    });
  });

  test('Explorar lleva a un destino aleatorio', async ({ page }) => {
    await test.step('Pulsar Explorar', async () => {
      await page.getByRole('button', { name: /explorar/i }).first().click();
    });

    await test.step('Verificar tarjeta de destino', async () => {
      await expect(page.locator('.destino-card h2')).toBeVisible();
    });
  });

  test('Filtrar por categoría Montaña', async ({ page }) => {
    await test.step('Elegir píldora Montaña', async () => {
      await page.getByRole('button', { name: 'Montaña', exact: true }).click();
    });

    await test.step('Verificar grid filtrado y conteo', async () => {
      await expect(page.locator('.grid .card')).toHaveCount(4);
      await expect(page.getByText('4 destinos de montaña esperándote.')).toBeVisible();
    });
  });

  test('Paginar el catálogo', async ({ page }) => {
    await test.step('Verificar primera página', async () => {
      await expect(page.locator('.grid .card')).toHaveCount(9);
      await expect(page.getByText('Página 1 de 5')).toBeVisible();
    });

    await test.step('Avanzar a la página 2', async () => {
      await page.getByRole('button', { name: /siguiente/i }).click();
      await expect(page.getByText('Página 2 de 5')).toBeVisible();
      await expect(page.locator('.grid .card')).toHaveCount(9);
    });
  });

  test('Guardar un favorito y filtrarlo', async ({ page }) => {
    await test.step('Marcar la primera tarjeta', async () => {
      await page.locator('.grid .card').first().getByRole('button', { name: /favorit/i }).click();
      await expect(page.getByRole('button', { name: /favoritos \(1\)/i })).toBeVisible();
    });

    await test.step('Filtrar por favoritos', async () => {
      await page.getByRole('button', { name: /favoritos \(1\)/i }).click();
      await expect(page.locator('.grid .card')).toHaveCount(1);
    });
  });

  test('Abrir la experiencia 360°', async ({ page }) => {
    await test.step('Explorar desde la primera tarjeta', async () => {
      await page.locator('.grid .card').first().getByRole('button', { name: /explorar/i }).click();
    });

    await test.step('Verificar modal con pestañas', async () => {
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('tab', { name: /street view|fotográfica/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /mapa/i })).toBeVisible();
    });
  });

  test('Modo tour recorre paradas con su barra', async ({ page }) => {
    await test.step('Iniciar tour', async () => {
      await page.getByRole('button', { name: /tour 360/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('region', { name: /modo tour/i })).toBeVisible();
    });

    await test.step('Avanzar a la parada 2', async () => {
      await expect(page.getByText('1/5', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Parada siguiente' }).click();
      await expect(page.getByText('2/5', { exact: true })).toBeVisible();
    });

    await test.step('Salir del tour', async () => {
      await page.getByRole('button', { name: /salir del tour/i }).click();
      await expect(page.getByRole('region', { name: /modo tour/i })).toHaveCount(0);
    });
  });

  test('Buscar insensible a acentos y mayúsculas', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: /buscar destinos/i });

    await test.step('Buscar "montana" sin tilde', async () => {
      await search.fill('montana');
      await expect(page.locator('.grid .card')).toHaveCount(4);
    });

    await test.step('Buscar "PISA" en mayúsculas', async () => {
      await search.fill('PISA');
      await expect(page.locator('.grid .card')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: /torre de pisa/i })).toBeVisible();
    });
  });
});

test.describe('Explorar sin API', () => {
  // Sin SW para que page.route intercepte el sorteo de forma determinista.
  test.use({ serviceWorkers: 'block' });

  test('un 404 de categoría muestra error y no inventa un destino', async ({ page }) => {
    await page.route('**/api/places/random*', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No hay lugares en la categoría "Montaña".' }),
      }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Montaña', exact: true }).click();
    await page.getByRole('button', { name: /explorar/i }).first().click();

    await expect(page.getByRole('alert')).toContainText(/no hay lugares/i);
    await expect(page.locator('.destino-card')).toHaveCount(0);
  });

  test('un 503 cae al catálogo local respetando la categoría', async ({ page }) => {
    await page.route('**/api/places/random*', (route) =>
      route.fulfill({ status: 503, body: '' }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Montaña', exact: true }).click();
    await page.getByRole('button', { name: /explorar/i }).first().click();

    await expect(page.locator('.destino-card .chip')).toHaveText('Montaña');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('sin red usa el catálogo local de la categoría', async ({ page }) => {
    await page.route('**/api/places/random*', (route) => route.abort());

    await page.goto('/');
    await page.getByRole('button', { name: 'Plaza', exact: true }).click();
    await page.getByRole('button', { name: /explorar/i }).first().click();

    await expect(page.locator('.destino-card .chip')).toHaveText('Plaza');
  });
});

test.describe('GeoVista PWA', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('precachea el shell y no el chunk 3D', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          urls.push(new URL(request.url).pathname);
        }
      }
      return urls;
    });

    expect(cached).toContain('/index.html');
    expect(cached).toContain('/earth-topology.png');
    expect(cached.some((url) => /^\/assets\/index-.*\.js$/.test(url))).toBe(true);
    expect(cached.some((url) => /ExploreModal/.test(url))).toBe(true);
    expect(cached.some((url) => /GlobeBackground/.test(url))).toBe(false);
  });

  test('la navegación funciona offline tras la primera visita', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect(page.getByText('45 destinos alrededor del mundo')).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: /descubre el mundo/i })).toBeVisible();
    await expect(page.getByText('45 destinos alrededor del mundo')).toBeVisible();
  });

  test('abrir un destino funciona offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.reload();
    await page.locator('.card').first().getByRole('button', { name: /explorar/i }).click();

    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal h2')).not.toBeEmpty();
  });
});

test.describe('GeoVista móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('globo 2D con continentes, sin cargar three.js', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });

    await page.goto('/');

    await test.step('El canvas del globo está visible y pintado', async () => {
      const canvas = page.locator('.globe-poster-canvas');
      await expect(canvas).toBeVisible();
      // La textura es local (/earth-topology.png): el píxel central debe tener
      // alpha > 0 cuando termina la proyección.
      await expect
        .poll(
          () =>
            canvas.evaluate((el: HTMLCanvasElement) => {
              const ctx = el.getContext('2d');
              if (!ctx) return 0;
              return ctx.getImageData(el.width / 2, el.height / 2, 1, 1).data[3];
            }),
          { timeout: 15000 },
        )
        .toBeGreaterThan(0);
    });

    await test.step('No se descarga el chunk 3D', async () => {
      expect(scripts.some((url) => /GlobeBackground[^/]*\.js/i.test(url))).toBe(false);
    });
  });
});
