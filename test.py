class Solution:
    def lengthOfLastWord(self, s: str) -> int:
        lst=s.split()
        print(lst)
        return len(lst[-1])
cl = Solution()
s = "luffy is still joyboy   "
print(cl.lengthOfLastWord(s))