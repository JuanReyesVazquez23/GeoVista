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
});
