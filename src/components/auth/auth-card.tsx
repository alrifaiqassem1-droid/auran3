'use client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

interface AuthCardProps {
  title: string;
  children: React.ReactNode;
}

export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <>
      <div className="absolute start-5 top-5 flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <span className="text-3xl font-bold tracking-widest text-primary">AURAN</span>
        </div>
        <Card className="bg-card/60 backdrop-blur-md border-border/60 shadow-2xl">
          <CardHeader className="pb-4">
            <h1 className="text-center text-xl font-bold">{title}</h1>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </motion.div>
    </>
  );
}
