'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const formSchema = z.object({
  verilog_code: z.string().min(1, 'Verilog code is required'),
  testbench_code: z.string().min(1, 'Testbench code is required'),
  top_module: z.string().min(1, 'Top module name is required'),
  top_testbench: z.string().min(1, 'Top testbench name is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function Home() {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001/api/v1';
      const response = await fetch(`${backendUrl}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Simulation failed');
      }

      const result = await response.json();
      setResult(result.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Verilog Simulator</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="verilog_code" className="block mb-2">Verilog Code</label>
          <textarea
            id="verilog_code"
            {...register('verilog_code')}
            className="w-full p-2 border rounded"
            rows={10}
          />
          {errors.verilog_code && (
            <p className="text-red-500">{errors.verilog_code.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="testbench_code" className="block mb-2">Testbench Code</label>
          <textarea
            id="testbench_code"
            {...register('testbench_code')}
            className="w-full p-2 border rounded"
            rows={10}
          />
          {errors.testbench_code && (
            <p className="text-red-500">{errors.testbench_code.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="top_module" className="block mb-2">Top Module Name</label>
          <input
            id="top_module"
            type="text"
            {...register('top_module')}
            className="w-full p-2 border rounded"
          />
          {errors.top_module && (
            <p className="text-red-500">{errors.top_module.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="top_testbench" className="block mb-2">Top Testbench Name</label>
          <input
            id="top_testbench"
            type="text"
            {...register('top_testbench')}
            className="w-full p-2 border rounded"
          />
          {errors.top_testbench && (
            <p className="text-red-500">{errors.top_testbench.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isLoading ? 'Simulating...' : 'Run Simulation'}
        </button>
      </form>

      {error && (
        <div className="mt-8 p-4 bg-red-100 text-red-700 rounded">
          <h2 className="font-bold">Error</h2>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Simulation Results</h2>
          <pre className="p-4 bg-gray-100 rounded overflow-auto">
            {result}
          </pre>
        </div>
      )}
    </main>
  );
} 