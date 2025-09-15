'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [loadingText, setLoadingText] = useState('');
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);
  const [showCircuit, setShowCircuit] = useState(false);

  useEffect(() => {
    // Animate the loading text
    const text = 'OpenNet';
    let currentText = '';
    let currentIndex = 0;
    
    const textInterval = setInterval(() => {
      if (currentIndex < text.length) {
        currentText += text[currentIndex];
        setLoadingText(currentText);
        currentIndex++;
      } else {
        clearInterval(textInterval);
      }
    }, 100);

    // Animate the dots
    const dotsInterval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 300);

    // Animate the progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Show circuit animation after a delay
    const circuitTimeout = setTimeout(() => {
      setShowCircuit(true);
    }, 1000);

    // Redirect after animation completes
    const redirectTimeout = setTimeout(() => {
      router.push('/simulation');
    }, 4000);

    return () => {
      clearInterval(textInterval);
      clearInterval(dotsInterval);
      clearInterval(progressInterval);
      clearTimeout(circuitTimeout);
      clearTimeout(redirectTimeout);
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#1e1e1e] text-white">
      <div className="relative mb-8">
        <h1 className="text-4xl font-bold text-blue-500">
          {loadingText}
          <span className="text-white">{dots}</span>
        </h1>
        
        {showCircuit && (
          <div className="absolute -bottom-12 left-0 right-0 flex justify-center">
            <div className="w-64 h-16 relative">
              {/* Circuit animation */}
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-pulse"></div>
              <div className="absolute top-0 left-0 w-1 h-8 bg-blue-500 animate-pulse"></div>
              <div className="absolute top-0 right-0 w-1 h-8 bg-blue-500 animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 animate-pulse"></div>
              
              {/* Circuit components */}
              <div className="absolute top-0 left-1/4 w-8 h-8 border-2 border-blue-500 rounded-full animate-ping"></div>
              <div className="absolute top-0 left-1/2 w-8 h-8 border-2 border-blue-500 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute top-0 left-3/4 w-8 h-8 border-2 border-blue-500 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
              
              {/* Binary animation */}
              <div className="absolute -top-6 left-0 right-0 text-xs text-blue-400 font-mono">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="inline-block mx-1 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
                    {Math.random() > 0.5 ? '1' : '0'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        {progress < 100 ? 'Initializing Verilog environment...' : 'Ready to simulate!'}
      </div>
    </div>
  );
} 