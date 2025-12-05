'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PomodoroSettings {
    workDuration: number;      // minutes
    shortBreak: number;         // minutes
    longBreak: number;          // minutes
    pomodorosUntilLongBreak: number;
    autoStartBreaks: boolean;
    autoStartWork: boolean;
}

export type SessionType = 'work' | 'break';

export interface TimerState {
    timeLeft: number;           // seconds
    isRunning: boolean;
    sessionType: SessionType;
    pomodoroCount: number;
    totalSeconds: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
    workDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    pomodorosUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false,
};

export function usePomodoroTimer(settings: PomodoroSettings = DEFAULT_SETTINGS) {
    const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [sessionType, setSessionType] = useState<SessionType>('work');
    const [pomodoroCount, setPomodoroCount] = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(settings.workDuration * 60);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Clear interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Timer countdown
    useEffect(() => {
        if (!isRunning) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handleSessionComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning]);

    const handleSessionComplete = useCallback(() => {
        setIsRunning(false);

        if (sessionType === 'work') {
            const newCount = pomodoroCount + 1;
            setPomodoroCount(newCount);

            // Determine break type
            const isLongBreak = newCount % settings.pomodorosUntilLongBreak === 0;
            const breakDuration = isLongBreak ? settings.longBreak : settings.shortBreak;

            setSessionType('break');
            setTimeLeft(breakDuration * 60);
            setTotalSeconds(breakDuration * 60);

            if (settings.autoStartBreaks) {
                setIsRunning(true);
            }
        } else {
            // Break ended
            setSessionType('work');
            setTimeLeft(settings.workDuration * 60);
            setTotalSeconds(settings.workDuration * 60);

            if (settings.autoStartWork) {
                setIsRunning(true);
            }
        }
    }, [sessionType, pomodoroCount, settings]);

    const start = useCallback(() => {
        setIsRunning(true);
    }, []);

    const pause = useCallback(() => {
        setIsRunning(false);
    }, []);

    const stop = useCallback(() => {
        setIsRunning(false);
        setTimeLeft(settings.workDuration * 60);
        setTotalSeconds(settings.workDuration * 60);
        setSessionType('work');
        setPomodoroCount(0);
    }, [settings.workDuration]);

    const reset = useCallback(() => {
        setIsRunning(false);
        const duration = sessionType === 'work' ? settings.workDuration : settings.shortBreak;
        setTimeLeft(duration * 60);
        setTotalSeconds(duration * 60);
    }, [sessionType, settings]);

    const skip = useCallback(() => {
        handleSessionComplete();
    }, [handleSessionComplete]);

    const getProgress = useCallback(() => {
        return totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;
    }, [timeLeft, totalSeconds]);

    return {
        timeLeft,
        isRunning,
        sessionType,
        pomodoroCount,
        totalSeconds,
        start,
        pause,
        stop,
        reset,
        skip,
        getProgress,
    };
}
