'use client';

import { useState, useCallback } from 'react';
import styles from './QuestionInput.module.css';

interface QuestionInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    maxLength?: number;
    label?: string;
    disabled?: boolean;
}

export function QuestionInput({
    value,
    onChange,
    placeholder = 'What would you like to explore? Enter your question or focus for this reading...',
    maxLength = 500,
    label = 'Your Question',
    disabled = false,
}: QuestionInputProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    const charCount = value.length;
    const isNearLimit = charCount > maxLength * 0.9;

    return (
        <div className={styles.container}>
            {label && <label className={styles.label}>{label}</label>}
            <textarea
                className={styles.textarea}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                maxLength={maxLength}
                disabled={disabled}
                rows={3}
            />
            <span className={`${styles.charCount} ${isNearLimit ? styles.charCountWarning : ''}`}>
                {charCount}/{maxLength}
            </span>
        </div>
    );
}
