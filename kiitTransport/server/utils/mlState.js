let latestAllocation = null;
let allocatedAt = null;

export const setLatestAllocation = (data) => {
    latestAllocation = data;
    allocatedAt = new Date().toISOString();
};

export const getLatestAllocation = () => {
    if (!latestAllocation) return null;
    return {
        ...latestAllocation,
        _meta: { allocatedAt }
    };
};