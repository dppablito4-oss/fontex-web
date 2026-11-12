import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FractionCanvas } from './FractionCanvas';
import { ThemeProvider } from '../theme/ThemeProvider';
describe('Lienzo de fracciones', () => {
  it('recorre las tres etapas, cambia las figuras y permite volver', () => {
    render(<ThemeProvider><FractionCanvas/></ThemeProvider>);
    expect(screen.getByRole('heading', { name: 'Fracciones', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^homogeneizar$/i }));
    expect(screen.getByText(/m.c.m.\(3, 6\) = 6/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /4 de 6 partes/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver resultado/i }));
    expect(screen.getByText('7/6 = 1 y 1/6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mostrar círculos/i }));
    expect(screen.getByRole('button', { name: /mostrar círculos/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /volver al inicio/i }));
    expect(screen.getByRole('heading', { name: 'Leer el dibujo' })).toBeInTheDocument();
  });
  it('muestra errores sin perder el dibujo y acepta una nueva operación', () => {
    render(<ThemeProvider><FractionCanvas/></ThemeProvider>);
    const input = screen.getByLabelText('Tu operación');
    fireEvent.change(input, { target: { value: '1/0 + 1/2' } });
    fireEvent.click(screen.getByRole('button', { name: /visualizar operación/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('denominador no puede ser cero');
    fireEvent.change(input, { target: { value: '1/2 + 1/4' } });
    fireEvent.click(screen.getByRole('button', { name: /visualizar operación/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^homogeneizar$/i }));
    expect(screen.getByRole('img', { name: /2 de 4 partes/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /añadir nota/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mi observación' }), { target: { value: 'La cantidad se conserva' } });
    expect(screen.getByDisplayValue('La cantidad se conserva')).toBeInTheDocument();
  });
});
