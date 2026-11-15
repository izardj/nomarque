import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { JoinWorldRequest, MeResponse } from '@nomarque/contracts';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SessionStore } from '../../core/session.store';
import { ME_WITH_DYNASTY, ME_WITHOUT_DYNASTY } from '../../core/testing';
import { fr } from '../../i18n/fr';
import { WorldJoinPage } from './world-join.page';

const nome = {
  id: 'n1',
  reignId: 'r1',
  name: 'Nome',
  region: 'delta',
  dynastyName: 'House',
  deben: 0,
  favor: 0,
} as const;

function setup(me: MeResponse, joinWorld = () => of({ nome })) {
  const join = vi.fn<
    (worldId: string, request: JoinWorldRequest) => ReturnType<typeof joinWorld>
  >(() => joinWorld());
  const load = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [WorldJoinPage],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { joinWorld: join } },
      { provide: SessionStore, useValue: { me: signal(me), load } },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(WorldJoinPage);
  fixture.componentRef.setInput('id', 'w1');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;

  function type(selector: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(selector);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  }

  async function submit(): Promise<void> {
    el.querySelector<HTMLFormElement>('form')?.dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function chooseRegion(region: string): void {
    el.querySelector<HTMLInputElement>(`#region-${region}`)?.click();
    fixture.detectChanges();
  }

  return { el, join, load, navigate, type, submit, chooseRegion };
}

describe('WorldJoinPage', () => {
  it('shows the three regions with their label and sentence', () => {
    const { el } = setup(ME_WITHOUT_DYNASTY);
    const text = el.textContent ?? '';
    expect(el.querySelectorAll('input[type="radio"]').length).toBe(3);
    for (const region of Object.values(fr.regions)) {
      expect(text).toContain(region.label);
      expect(text).toContain(region.blurb);
    }
  });

  it('asks for a dynasty name, prefilled, when the player has none', () => {
    const { el } = setup(ME_WITHOUT_DYNASTY);
    const input = el.querySelector<HTMLInputElement>('#join-dynasty-name');

    expect(input).not.toBeNull();
    expect(el.querySelector('label[for="join-dynasty-name"]')).not.toBeNull();
    expect(fr.join.dynastyProposals).toContain(input?.value);
  });

  it('does not ask for a dynasty name when the player already has one', () => {
    const { el } = setup(ME_WITH_DYNASTY);
    expect(el.querySelector('#join-dynasty-name')).toBeNull();
  });

  it('joins with the dynasty name and opens the nome', async () => {
    const { join, load, navigate, type, submit, chooseRegion } =
      setup(ME_WITHOUT_DYNASTY);
    chooseRegion('delta');
    type('#join-nome-name', '  Nome du Faucon ');
    type('#join-dynasty-name', 'House of Test');
    await submit();

    expect(join).toHaveBeenCalledWith('w1', {
      region: 'delta',
      nomeName: 'Nome du Faucon',
      dynastyName: 'House of Test',
    });
    expect(load).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/worlds', 'w1', 'nome']);
  });

  it('omits the dynasty name when the player already has one', async () => {
    const { join, type, submit, chooseRegion } = setup(ME_WITH_DYNASTY);
    chooseRegion('upper_egypt');
    type('#join-nome-name', 'Nome');
    await submit();

    expect(join).toHaveBeenCalledWith('w1', {
      region: 'upper_egypt',
      nomeName: 'Nome',
    });
  });

  it('asks for a region before calling the API', async () => {
    const { el, join, type, submit } = setup(ME_WITH_DYNASTY);
    type('#join-nome-name', 'Nome');
    await submit();

    expect(join).not.toHaveBeenCalled();
    expect(el.textContent).toContain(fr.join.regionRequired);
  });

  it('shows already_joined in French with a link to the nome', async () => {
    const { el, navigate, type, submit, chooseRegion } = setup(
      ME_WITH_DYNASTY,
      () =>
        throwError(() => ({
          statusCode: 409,
          code: 'already_joined',
          message: 'x',
        })),
    );
    chooseRegion('middle_egypt');
    type('#join-nome-name', 'Nome');
    await submit();

    expect(el.textContent).toContain(fr.errors.already_joined);
    expect(el.querySelector('a[href="/worlds/w1/nome"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
