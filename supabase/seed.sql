-- Initial Seed Data for Skills

DO $$
DECLARE
    frontend_id UUID := gen_random_uuid();
    backend_id UUID := gen_random_uuid();
    web3_id UUID := gen_random_uuid();
    design_id UUID := gen_random_uuid();
BEGIN
    -- Insert Categories
    INSERT INTO skill_categories (id, name) VALUES
    (frontend_id, 'Frontend Development'),
    (backend_id, 'Backend Development'),
    (web3_id, 'Web3 & Blockchain'),
    (design_id, 'Design & UX')
    ON CONFLICT (name) DO NOTHING;

    -- Retrieve IDs (in case they already existed and ON CONFLICT was triggered)
    SELECT id INTO frontend_id FROM skill_categories WHERE name = 'Frontend Development';
    SELECT id INTO backend_id FROM skill_categories WHERE name = 'Backend Development';
    SELECT id INTO web3_id FROM skill_categories WHERE name = 'Web3 & Blockchain';
    SELECT id INTO design_id FROM skill_categories WHERE name = 'Design & UX';

    -- Insert Skills
    INSERT INTO skills (category_id, name, slug) VALUES
    (frontend_id, 'React', 'react'),
    (frontend_id, 'Next.js', 'nextjs'),
    (frontend_id, 'Vue.js', 'vuejs'),
    (frontend_id, 'Tailwind CSS', 'tailwindcss'),
    
    (backend_id, 'Node.js', 'nodejs'),
    (backend_id, 'Python', 'python'),
    (backend_id, 'Rust', 'rust'),
    (backend_id, 'PostgreSQL', 'postgresql'),
    
    (web3_id, 'Solidity', 'solidity'),
    (web3_id, 'Stellar', 'stellar'),
    (web3_id, 'Soroban', 'soroban'),
    (web3_id, 'Ethers.js', 'ethersjs'),
    
    (design_id, 'Figma', 'figma'),
    (design_id, 'UI/UX Design', 'ui-ux-design'),
    (design_id, 'Prototyping', 'prototyping')
    ON CONFLICT (slug) DO NOTHING;
END $$;
