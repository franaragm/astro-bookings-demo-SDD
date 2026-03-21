import { expect, test } from '@playwright/test';
import type { Express } from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTestCustomer, createTestLaunch, createTestRocket } from './helpers/testSetup.js';

let server: http.Server;
let baseURL: string;
let app: Express;

test.beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('../src/index'));

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, () => resolve());
    server.on('error', reject);
  });

  const address = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
});

test.describe('Launch Lifecycle Guards', () => {
  test('creates launches with scheduled status by default', async ({ request }) => {
    const rocket = await createTestRocket(request, baseURL);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const response = await request.post(`${baseURL}/api/launches`, {
      data: {
        rocketId: rocket.id,
        scheduledDate: futureDate.toISOString(),
        price: 125,
        minimumPassengers: 1,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('scheduled');
  });

  test('accepts valid transitions scheduled -> active and active -> completed', async ({ request }) => {
    const rocket = await createTestRocket(request, baseURL);

    const launch = await createTestLaunch(request, baseURL, rocket.id, 100, 'scheduled');

    const toActiveResponse = await request.put(`${baseURL}/api/launches/${launch.id}`, {
      data: { status: 'active' },
    });

    expect(toActiveResponse.status()).toBe(200);
    const activeBody = await toActiveResponse.json();
    expect(activeBody.status).toBe('active');

    const toCompletedResponse = await request.put(`${baseURL}/api/launches/${launch.id}`, {
      data: { status: 'completed' },
    });

    expect(toCompletedResponse.status()).toBe(200);
    const completedBody = await toCompletedResponse.json();
    expect(completedBody.status).toBe('completed');
  });

  test('accepts valid transitions to cancelled from scheduled and active', async ({ request }) => {
    const rocket = await createTestRocket(request, baseURL);

    const scheduledLaunch = await createTestLaunch(request, baseURL, rocket.id, 100, 'scheduled');
    const scheduledCancelResponse = await request.put(`${baseURL}/api/launches/${scheduledLaunch.id}`, {
      data: { status: 'cancelled' },
    });

    expect(scheduledCancelResponse.status()).toBe(200);
    const scheduledCancelBody = await scheduledCancelResponse.json();
    expect(scheduledCancelBody.status).toBe('cancelled');

    const activeLaunch = await createTestLaunch(request, baseURL, rocket.id, 100, 'active');
    const activeCancelResponse = await request.put(`${baseURL}/api/launches/${activeLaunch.id}`, {
      data: { status: 'cancelled' },
    });

    expect(activeCancelResponse.status()).toBe(200);
    const activeCancelBody = await activeCancelResponse.json();
    expect(activeCancelBody.status).toBe('cancelled');
  });

  test('rejects transitions outside the lifecycle graph', async ({ request }) => {
    const rocket = await createTestRocket(request, baseURL);
    const launch = await createTestLaunch(request, baseURL, rocket.id, 100, 'scheduled');

    const response = await request.put(`${baseURL}/api/launches/${launch.id}`, {
      data: { status: 'completed' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation error');
    expect(body.details.some((detail: { field: string; message: string }) => detail.field === 'status')).toBe(true);
  });

  test('rejects any further transition from completed and cancelled', async ({ request }) => {
    const rocket = await createTestRocket(request, baseURL);

    const completedLaunch = await createTestLaunch(request, baseURL, rocket.id, 100, 'completed');
    const fromCompletedResponse = await request.put(`${baseURL}/api/launches/${completedLaunch.id}`, {
      data: { status: 'active' },
    });

    expect(fromCompletedResponse.status()).toBe(400);

    const cancelledLaunch = await createTestLaunch(request, baseURL, rocket.id, 100, 'cancelled');
    const fromCancelledResponse = await request.put(`${baseURL}/api/launches/${cancelledLaunch.id}`, {
      data: { status: 'active' },
    });

    expect(fromCancelledResponse.status()).toBe(400);
  });

  test('rejects booking when launch is not active', async ({ request }) => {
    const rocket = await createTestRocket(request, baseURL);
    const customer = await createTestCustomer(request, baseURL);
    const launch = await createTestLaunch(request, baseURL, rocket.id, 100, 'cancelled');

    const response = await request.post(`${baseURL}/api/bookings`, {
      data: {
        launchId: launch.id,
        customerEmail: customer.email,
        seatCount: 1,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Launch is not available for booking');
  });
});
