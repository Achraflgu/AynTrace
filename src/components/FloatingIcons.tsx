import { MapPin, Satellite, Car, Dog, Shield, Navigation, Baby, Wifi, Briefcase, Bike, Smartphone, Watch, Radio, Globe, Truck, Lock } from 'lucide-react';

import { useTheme } from '@/lib/theme';

/**
 * Shared floating animated background icons for all public pages.
 * Creates a consistent premium visual across home, login, guide, etc.
 */

const bgIcons = [
  { Icon: MapPin, size: 22, x: '3%', y: '8%', delay: '0s', dur: '7s', op: 0.14 },
  { Icon: Satellite, size: 18, x: '92%', y: '5%', delay: '1.2s', dur: '9s', op: 0.12 },
  { Icon: Car, size: 20, x: '88%', y: '18%', delay: '0.5s', dur: '6s', op: 0.10 },
  { Icon: Dog, size: 16, x: '7%', y: '25%', delay: '2s', dur: '8s', op: 0.13 },
  { Icon: Shield, size: 24, x: '95%', y: '35%', delay: '3s', dur: '7.5s', op: 0.10 },
  { Icon: Navigation, size: 18, x: '5%', y: '42%', delay: '1.5s', dur: '6.5s', op: 0.12 },
  { Icon: Baby, size: 14, x: '90%', y: '48%', delay: '4s', dur: '8.5s', op: 0.10 },
  { Icon: Wifi, size: 20, x: '8%', y: '55%', delay: '0.8s', dur: '7s', op: 0.13 },
  { Icon: Briefcase, size: 16, x: '93%', y: '62%', delay: '2.5s', dur: '9s', op: 0.10 },
  { Icon: Bike, size: 20, x: '4%', y: '68%', delay: '3.5s', dur: '6s', op: 0.12 },
  { Icon: Smartphone, size: 15, x: '91%', y: '75%', delay: '1s', dur: '7.5s', op: 0.10 },
  { Icon: Watch, size: 14, x: '6%', y: '82%', delay: '4.5s', dur: '8s', op: 0.13 },
  { Icon: MapPin, size: 18, x: '94%', y: '88%', delay: '2s', dur: '6.5s', op: 0.10 },
  { Icon: Satellite, size: 16, x: '3%', y: '92%', delay: '0.3s', dur: '9s', op: 0.12 },
  { Icon: Radio, size: 20, x: '50%', y: '4%', delay: '1.8s', dur: '7s', op: 0.08 },
  { Icon: Globe, size: 18, x: '50%', y: '95%', delay: '3.2s', dur: '8s', op: 0.08 },
  { Icon: Truck, size: 16, x: '15%', y: '15%', delay: '2.2s', dur: '8.5s', op: 0.08 },
  { Icon: Dog, size: 14, x: '85%', y: '92%', delay: '0.7s', dur: '7s', op: 0.08 },
  { Icon: Lock, size: 14, x: '12%', y: '72%', delay: '4s', dur: '6s', op: 0.08 },
  { Icon: Car, size: 16, x: '82%', y: '42%', delay: '1.4s', dur: '8s', op: 0.08 },
];

const FloatingIcons = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {bgIcons.map((item, i) => (
          <div
            key={i}
            className={`absolute flex items-center justify-center ${isDark ? 'text-[#039C51] drop-shadow-[0_0_10px_rgba(3,156,81,0.3)]' : 'text-[#039C51] drop-shadow-[0_0_15px_rgba(3,156,81,0.6)]'}`}
            style={{
              left: item.x,
              top: item.y,
              opacity: isDark ? item.op * 2 : item.op * 3.5, // Increased significantly for light mode
              animation: `geoFloat${i % 4} ${item.dur} ease-in-out ${item.delay} infinite`,
            }}
          >
            <item.Icon size={item.size} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes geoFloat0 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-18px) rotate(5deg); }
          50% { transform: translateY(-8px) rotate(-3deg); }
          75% { transform: translateY(-22px) rotate(7deg); }
        }
        @keyframes geoFloat1 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-14px) translateX(8px); }
          66% { transform: translateY(-24px) translateX(-6px); }
        }
        @keyframes geoFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          25% { transform: translateY(-16px) scale(1.15); }
          50% { transform: translateY(-6px) scale(0.9); }
          75% { transform: translateY(-20px) scale(1.08); }
        }
        @keyframes geoFloat3 {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
          20% { transform: translateY(-12px) translateX(-10px) rotate(-8deg); }
          40% { transform: translateY(-20px) translateX(5px) rotate(4deg); }
          60% { transform: translateY(-8px) translateX(12px) rotate(-3deg); }
          80% { transform: translateY(-16px) translateX(-6px) rotate(6deg); }
        }
      `}</style>
    </>
  );
};

export default FloatingIcons;
